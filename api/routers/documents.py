import io
import json
import logging
from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import auth
import database
import models
import schemas
from schemas_documents import (
    DocumentEntryOut,
    DocumentEntryUpdate,
    DocumentTypeDefinitionCreate,
    DocumentTypeDefinitionOut,
    DocumentTypeDefinitionUpdate,
    LoadDefaultsResponse,
)
from utils import gcs_storage
from utils.document_content import extract_searchable_text
from utils.document_vault import (
    build_search_text,
    ensure_system_default_document_types,
    load_missing_default_document_types,
    seed_default_document_types,
    slugify_template_key,
    suggest_folder_label,
)
from utils.permissions import check_permission
from utils.subscription import get_user_limits

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)


def _resolve_owner_id(
    db: Session,
    current_user: schemas.UserOut,
    viewing_user_id: Optional[int],
    required_permission: str = "view",
) -> int:
    if viewing_user_id in (None, current_user.id):
        return current_user.id

    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=viewing_user_id,
        permission_type="document_vault",
        required_permission=required_permission,
    )
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this user's vault")
    return viewing_user_id


def _serialize_definition(definition: models.DocumentTypeDefinition) -> dict:
    return {
        "id": definition.id,
        "owner_id": definition.owner_id,
        "category": definition.category,
        "doc_type": definition.doc_type,
        "description": definition.description,
        "fields_config": definition.fields_config or [],
        "is_active": definition.is_active,
        "is_system_default": definition.is_system_default,
        "template_key": definition.template_key,
        "created_at": definition.created_at,
        "updated_at": definition.updated_at,
    }


def _serialize_entry(db: Session, entry: models.DocumentEntry) -> dict:
    owner = db.query(models.User).filter(models.User.id == entry.owner_id).first()
    return {
        "id": entry.id,
        "owner_id": entry.owner_id,
        "owner_email": owner.email if owner else None,
        "definition_id": entry.definition_id,
        "category": entry.category,
        "doc_type": entry.doc_type,
        "title": entry.title,
        "description": entry.description,
        "notes": entry.notes,
        "metadata_json": entry.metadata_json or {},
        "folder_label": entry.folder_label,
        "file_name": entry.file_name,
        "file_type": entry.file_type,
        "file_size": entry.file_size,
        "storage_path": entry.storage_path,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


def _get_editable_definition(
    db: Session,
    definition_id: int,
    current_user: schemas.UserOut,
    allow_system_default: bool = False,
) -> models.DocumentTypeDefinition:
    definition = db.query(models.DocumentTypeDefinition).filter(
        models.DocumentTypeDefinition.id == definition_id
    ).first()
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")

    if definition.is_system_default:
        if not allow_system_default or not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot edit this definition")
    else:
        has_permission = check_permission(
            db=db,
            current_user_id=current_user.id,
            primary_user_id=definition.owner_id,
            permission_type="document_vault",
            required_permission="edit",
        )
        if not has_permission:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot edit this definition")

    return definition


def _validate_definition_for_owner(
    db: Session,
    definition_id: Optional[int],
    owner_id: int,
    current_user: schemas.UserOut,
) -> Optional[models.DocumentTypeDefinition]:
    if not definition_id:
        return None

    definition = db.query(models.DocumentTypeDefinition).filter(
        models.DocumentTypeDefinition.id == definition_id
    ).first()
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")

    if definition.is_system_default:
        if not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please use a user-owned definition")
        return definition

    if definition.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Definition does not belong to this vault owner")

    return definition


def _refresh_search_vector(db: Session, entry: models.DocumentEntry) -> None:
    search_text = build_search_text(
        title=entry.title,
        description=entry.description,
        notes=entry.notes,
        category=entry.category,
        doc_type=entry.doc_type,
        metadata_json=entry.metadata_json,
        content_text=entry.content_text,
    )
    db.execute(
        sa.text(
            "UPDATE document_entries "
            "SET search_vector = to_tsvector('simple', :search_text) "
            "WHERE id = :entry_id"
        ),
        {"search_text": search_text, "entry_id": entry.id},
    )
    db.commit()
    db.refresh(entry)


@router.get("/definitions", response_model=List[DocumentTypeDefinitionOut])
def list_definitions(
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    owner_id = _resolve_owner_id(db, current_user, viewing_user_id, "view")
    definitions = db.query(models.DocumentTypeDefinition).filter(
        models.DocumentTypeDefinition.owner_id == owner_id
    ).order_by(models.DocumentTypeDefinition.category.asc(), models.DocumentTypeDefinition.doc_type.asc()).all()
    return [_serialize_definition(definition) for definition in definitions]


@router.post("/definitions", response_model=DocumentTypeDefinitionOut, status_code=status.HTTP_201_CREATED)
def create_definition(
    payload: DocumentTypeDefinitionCreate,
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    owner_id = _resolve_owner_id(db, current_user, viewing_user_id, "edit")
    definition = models.DocumentTypeDefinition(
        owner_id=owner_id,
        category=payload.category.strip(),
        doc_type=payload.doc_type.strip(),
        description=payload.description,
        fields_config=[field.model_dump() for field in payload.fields_config],
        is_active=payload.is_active,
        is_system_default=False,
        template_key=None,
    )
    db.add(definition)
    db.commit()
    db.refresh(definition)
    return _serialize_definition(definition)


@router.put("/definitions/{definition_id}", response_model=DocumentTypeDefinitionOut)
def update_definition(
    definition_id: int,
    payload: DocumentTypeDefinitionUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    definition = _get_editable_definition(db, definition_id, current_user, allow_system_default=False)

    if payload.category is not None:
        definition.category = payload.category.strip()
    if payload.doc_type is not None:
        definition.doc_type = payload.doc_type.strip()
    if payload.description is not None:
        definition.description = payload.description
    if payload.fields_config is not None:
        definition.fields_config = [field.model_dump() for field in payload.fields_config]
    if payload.is_active is not None:
        definition.is_active = payload.is_active

    db.commit()
    db.refresh(definition)
    return _serialize_definition(definition)


@router.delete("/definitions/{definition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_definition(
    definition_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    definition = _get_editable_definition(db, definition_id, current_user, allow_system_default=False)
    db.delete(definition)
    db.commit()
    return None


@router.post("/definitions/load-recommended-defaults", response_model=LoadDefaultsResponse)
def load_recommended_defaults(
    viewing_user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    owner_id = _resolve_owner_id(db, current_user, viewing_user_id, "edit")
    created = load_missing_default_document_types(db, owner_id)
    message = "Recommended defaults loaded." if created else "All recommended defaults already exist."
    return {"created": created, "message": message}


@router.get("/default-definitions", response_model=List[DocumentTypeDefinitionOut])
def list_default_definitions(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_admin_user),
):
    definitions = db.query(models.DocumentTypeDefinition).filter(
        models.DocumentTypeDefinition.is_system_default.is_(True),
        models.DocumentTypeDefinition.is_active.is_(True),
    ).order_by(models.DocumentTypeDefinition.category.asc(), models.DocumentTypeDefinition.doc_type.asc()).all()
    return [_serialize_definition(definition) for definition in definitions]


@router.post("/default-definitions", response_model=DocumentTypeDefinitionOut, status_code=status.HTTP_201_CREATED)
def create_default_definition(
    payload: DocumentTypeDefinitionCreate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_admin_user),
):
    definition = models.DocumentTypeDefinition(
        owner_id=None,
        category=payload.category.strip(),
        doc_type=payload.doc_type.strip(),
        description=payload.description,
        fields_config=[field.model_dump() for field in payload.fields_config],
        is_active=payload.is_active,
        is_system_default=True,
        template_key=slugify_template_key(payload.category, payload.doc_type),
    )
    db.add(definition)
    db.commit()
    db.refresh(definition)
    return _serialize_definition(definition)


@router.put("/default-definitions/{definition_id}", response_model=DocumentTypeDefinitionOut)
def update_default_definition(
    definition_id: int,
    payload: DocumentTypeDefinitionUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_admin_user),
):
    definition = _get_editable_definition(db, definition_id, current_user, allow_system_default=True)
    if payload.category is not None:
        definition.category = payload.category.strip()
    if payload.doc_type is not None:
        definition.doc_type = payload.doc_type.strip()
    if payload.description is not None:
        definition.description = payload.description
    if payload.fields_config is not None:
        definition.fields_config = [field.model_dump() for field in payload.fields_config]
    if payload.is_active is not None:
        definition.is_active = payload.is_active
    # Preserve the original template key so admin renames/merges
    # don't cause the code-defined default to be recreated later.
    if not definition.template_key:
        definition.template_key = slugify_template_key(definition.category, definition.doc_type)
    db.commit()
    db.refresh(definition)
    return _serialize_definition(definition)


@router.delete("/default-definitions/{definition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_default_definition(
    definition_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_admin_user),
):
    definition = _get_editable_definition(db, definition_id, current_user, allow_system_default=True)
    # Soft-delete system defaults so they stay hidden from users
    # without being silently recreated from the built-in defaults list.
    definition.is_active = False
    db.commit()
    return None


@router.get("/entries", response_model=List[DocumentEntryOut])
def list_entries(
    viewing_user_id: Optional[int] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    doc_type: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    owner_id = _resolve_owner_id(db, current_user, viewing_user_id, "view")
    query = db.query(models.DocumentEntry).filter(models.DocumentEntry.owner_id == owner_id)

    if category:
        query = query.filter(models.DocumentEntry.category == category)
    if doc_type:
        query = query.filter(models.DocumentEntry.doc_type == doc_type)
    if search:
        like_term = f"%{search.strip()}%"
        query = query.filter(
            sa.or_(
                models.DocumentEntry.title.ilike(like_term),
                models.DocumentEntry.description.ilike(like_term),
                models.DocumentEntry.notes.ilike(like_term),
                models.DocumentEntry.category.ilike(like_term),
                models.DocumentEntry.doc_type.ilike(like_term),
                sa.cast(models.DocumentEntry.metadata_json, sa.Text).ilike(like_term),
                models.DocumentEntry.content_text.ilike(like_term),
                sa.text("document_entries.search_vector @@ websearch_to_tsquery('simple', :search_query)"),
            )
        ).params(search_query=search.strip())
        query = query.order_by(sa.text("ts_rank(document_entries.search_vector, websearch_to_tsquery('simple', :search_query)) DESC")).params(search_query=search.strip())
    else:
        query = query.order_by(models.DocumentEntry.created_at.desc())

    entries = query.all()
    return [_serialize_entry(db, entry) for entry in entries]


@router.post("/entries", response_model=DocumentEntryOut, status_code=status.HTTP_201_CREATED)
async def create_entry(
    title: str = Form(...),
    category: str = Form(...),
    doc_type: str = Form(...),
    description: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    definition_id: Optional[int] = Form(None),
    folder_label: Optional[str] = Form(None),
    metadata_json: Optional[str] = Form(None),
    viewing_user_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    owner_id = _resolve_owner_id(db, current_user, viewing_user_id, "edit")
    limits = get_user_limits(db, current_user)
    if limits["is_limited"] and limits["max_documents"] is not None:
        existing_count = db.query(models.DocumentEntry).filter(models.DocumentEntry.owner_id == owner_id).count()
        if existing_count >= limits["max_documents"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Free plan supports up to {limits['max_documents']} document vault entries.",
            )

    definition = _validate_definition_for_owner(db, definition_id, owner_id, current_user)
    if definition:
        category = definition.category
        doc_type = definition.doc_type

    parsed_metadata = {}
    if metadata_json:
        try:
            parsed_metadata = json.loads(metadata_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid metadata JSON: {exc}") from exc

    storage_path = None
    file_name = None
    file_type = None
    file_size = None
    content_text = ""
    file_content = None

    if file is not None:
        file_content = await file.read()
        file_size = len(file_content)
        file_name = file.filename
        file_type = file.content_type
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        storage_path = f"vault/user_{owner_id}/{timestamp}_{file.filename}"
        gcs_storage.upload_file(io.BytesIO(file_content), storage_path, file.content_type)
        content_text = extract_searchable_text(file_content, file.content_type, file.filename)

    entry = models.DocumentEntry(
        owner_id=owner_id,
        definition_id=definition.id if definition else None,
        category=category.strip(),
        doc_type=doc_type.strip(),
        title=title.strip(),
        description=description,
        notes=notes,
        metadata_json=parsed_metadata,
        folder_label=folder_label or suggest_folder_label(category, doc_type),
        file_name=file_name,
        file_type=file_type,
        file_size=file_size,
        storage_path=storage_path,
        content_text=content_text,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    _refresh_search_vector(db, entry)
    return _serialize_entry(db, entry)


@router.get("/entries/{entry_id}", response_model=DocumentEntryOut)
def get_entry(
    entry_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    entry = db.query(models.DocumentEntry).filter(models.DocumentEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault entry not found")
    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=entry.owner_id,
        permission_type="document_vault",
        required_permission="view",
    )
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to view this vault entry")
    return _serialize_entry(db, entry)


@router.put("/entries/{entry_id}", response_model=DocumentEntryOut)
def update_entry(
    entry_id: int,
    payload: DocumentEntryUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    entry = db.query(models.DocumentEntry).filter(models.DocumentEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault entry not found")

    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=entry.owner_id,
        permission_type="document_vault",
        required_permission="edit",
    )
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to edit this vault entry")

    definition = _validate_definition_for_owner(db, payload.definition_id, entry.owner_id, current_user) if payload.definition_id else None
    if definition:
        entry.definition_id = definition.id
        entry.category = definition.category
        entry.doc_type = definition.doc_type
    elif payload.definition_id is not None:
        entry.definition_id = None

    if payload.category is not None and not definition:
        entry.category = payload.category.strip()
    if payload.doc_type is not None and not definition:
        entry.doc_type = payload.doc_type.strip()
    if payload.title is not None:
        entry.title = payload.title.strip()
    if payload.description is not None:
        entry.description = payload.description
    if payload.notes is not None:
        entry.notes = payload.notes
    if payload.metadata_json is not None:
        entry.metadata_json = payload.metadata_json
    if payload.folder_label is not None:
        entry.folder_label = payload.folder_label or suggest_folder_label(entry.category, entry.doc_type)

    db.commit()
    db.refresh(entry)
    _refresh_search_vector(db, entry)
    return _serialize_entry(db, entry)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    entry = db.query(models.DocumentEntry).filter(models.DocumentEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault entry not found")

    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=entry.owner_id,
        permission_type="document_vault",
        required_permission="edit",
    )
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete this vault entry")

    if entry.storage_path:
        gcs_storage.delete_file(entry.storage_path)

    db.delete(entry)
    db.commit()
    return None


@router.get("/entries/{entry_id}/download")
async def download_entry_file(
    entry_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user),
):
    entry = db.query(models.DocumentEntry).filter(models.DocumentEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vault entry not found")
    if not entry.storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No file is attached to this vault entry")

    has_permission = check_permission(
        db=db,
        current_user_id=current_user.id,
        primary_user_id=entry.owner_id,
        permission_type="document_vault",
        required_permission="view",
    )
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to download this file")

    file_content = gcs_storage.download_file(entry.storage_path)
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=entry.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{entry.file_name or entry.title}"'},
    )


@router.post("/bootstrap-defaults", response_model=LoadDefaultsResponse)
def bootstrap_current_user_defaults(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_admin_user),
):
    ensure_system_default_document_types(db)
    created = seed_default_document_types(db, current_user.id)
    return {"created": created, "message": "Recommended defaults bootstrapped."}

