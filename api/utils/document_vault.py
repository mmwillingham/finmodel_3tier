from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

import models
from utils.document_folder_defaults import DEFAULT_DOCUMENT_FOLDER_STRUCTURE
from utils.document_vault_defaults import build_default_document_type_definitions


def build_search_text(
    *,
    title: str | None,
    description: str | None,
    notes: str | None,
    category: str | None,
    doc_type: str | None,
    metadata_json: dict | None,
    content_text: str | None,
) -> str:
    metadata_parts = []
    for key, value in flatten_metadata(metadata_json or {}):
        metadata_parts.append(f"{key} {value}")

    pieces = [
        title or "",
        description or "",
        notes or "",
        category or "",
        doc_type or "",
        " ".join(metadata_parts),
        content_text or "",
    ]
    return "\n".join(piece for piece in pieces if piece).strip()


def flatten_metadata(value, prefix: str = "") -> Iterable[tuple[str, str]]:
    if isinstance(value, dict):
        for key, inner in value.items():
            new_prefix = f"{prefix}.{key}" if prefix else str(key)
            yield from flatten_metadata(inner, new_prefix)
    elif isinstance(value, list):
        for index, inner in enumerate(value):
            new_prefix = f"{prefix}[{index}]"
            yield from flatten_metadata(inner, new_prefix)
    elif value is not None:
        yield prefix, str(value)


def slugify_template_key(category: str, doc_type: str) -> str:
    raw = f"{category}-{doc_type}".strip().lower()
    cleaned = []
    previous_dash = False
    for char in raw:
        if char.isalnum():
            cleaned.append(char)
            previous_dash = False
        elif not previous_dash:
            cleaned.append("-")
            previous_dash = True
    return "".join(cleaned).strip("-")


def _get_default_folder_structure(db: Session):
    global_settings = db.query(models.GlobalSettings).first()
    if global_settings and global_settings.default_document_folders:
        return global_settings.default_document_folders
    return DEFAULT_DOCUMENT_FOLDER_STRUCTURE


def seed_default_document_types(db: Session, owner_id: int) -> int:
    defaults = db.query(models.DocumentTypeDefinition).filter(
        models.DocumentTypeDefinition.is_system_default.is_(True),
        models.DocumentTypeDefinition.is_active.is_(True),
    ).order_by(models.DocumentTypeDefinition.id.asc()).all()

    if not defaults:
        return 0

    return load_missing_default_document_types(db, owner_id)


def load_missing_default_document_types(db: Session, owner_id: int) -> int:
    defaults = db.query(models.DocumentTypeDefinition).filter(
        models.DocumentTypeDefinition.is_system_default.is_(True),
        models.DocumentTypeDefinition.is_active.is_(True),
    ).order_by(models.DocumentTypeDefinition.id.asc()).all()

    existing_template_keys = {
        row[0]
        for row in db.query(models.DocumentTypeDefinition.template_key).filter(
            models.DocumentTypeDefinition.owner_id == owner_id,
            models.DocumentTypeDefinition.template_key.is_not(None),
        ).all()
    }

    created = 0
    for default in defaults:
        if default.template_key and default.template_key in existing_template_keys:
            continue

        copied = models.DocumentTypeDefinition(
            owner_id=owner_id,
            category=default.category,
            doc_type=default.doc_type,
            description=default.description,
            fields_config=default.fields_config,
            is_active=default.is_active,
            is_system_default=False,
            template_key=default.template_key,
        )
        db.add(copied)
        created += 1

    if created:
        db.commit()
    return created


def ensure_system_default_document_types(db: Session) -> int:
    existing_template_keys = {
        row[0]
        for row in db.query(models.DocumentTypeDefinition.template_key).filter(
            models.DocumentTypeDefinition.is_system_default.is_(True),
            models.DocumentTypeDefinition.template_key.is_not(None),
        ).all()
    }

    created = 0
    for item in build_default_document_type_definitions(_get_default_folder_structure(db)):
        template_key = item.get("template_key") or slugify_template_key(item["category"], item["doc_type"])
        if template_key in existing_template_keys:
            continue
        definition = models.DocumentTypeDefinition(
            owner_id=None,
            category=item["category"],
            doc_type=item["doc_type"],
            description=item.get("description"),
            fields_config=item["fields_config"],
            is_active=True,
            is_system_default=True,
            template_key=template_key,
        )
        db.add(definition)
        created += 1

    if created:
        db.commit()
    return created


def suggest_folder_label(category: str | None, doc_type: str | None) -> str | None:
    category_map = {
        "Financial": "Financial Records",
        "Legal": "Legal Documents",
        "Health": "Health Records",
        "Digital Assets": "Digital Access",
        "Contacts": "Contacts",
        "Home & Property": "Property Records",
        "IDs & Vital Info": "Vital Records",
        "Aging": "Care Planning",
        "Legacy": "Legacy Planning",
    }
    if doc_type == "Emergency Contact":
        return "Contacts"
    return category_map.get(category or "")
