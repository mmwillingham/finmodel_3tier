import logging
from copy import deepcopy
from sqlalchemy.orm import Session

import models
from utils.document_folder_defaults import DEFAULT_DOCUMENT_FOLDER_STRUCTURE

logger = logging.getLogger(__name__)


def _resolve_structure(db: Session, structure=None):
    if structure is not None:
        return deepcopy(structure)

    global_settings = db.query(models.GlobalSettings).first()
    if global_settings and global_settings.default_document_folders:
        return deepcopy(global_settings.default_document_folders)

    return deepcopy(DEFAULT_DOCUMENT_FOLDER_STRUCTURE)


def create_default_document_folders(db: Session, owner_id: int, structure=None) -> bool:
    """
    Ensure a user receives the default Document Vault folder hierarchy.
    Returns True if any folders were created.
    """
    resolved_structure = _resolve_structure(db, structure)
    created_any = False

    def ensure_folder(folder_name, parent_id):
        nonlocal created_any
        query = db.query(models.DocumentFolder).filter(
            models.DocumentFolder.owner_id == owner_id,
            models.DocumentFolder.name == folder_name,
        )
        if parent_id is None:
            query = query.filter(models.DocumentFolder.parent_folder_id.is_(None))
        else:
            query = query.filter(models.DocumentFolder.parent_folder_id == parent_id)
        existing_folder = query.first()
        if existing_folder:
            return existing_folder.id

        new_folder = models.DocumentFolder(
            owner_id=owner_id,
            name=folder_name,
            parent_folder_id=parent_id,
        )
        db.add(new_folder)
        db.flush()
        created_any = True
        return new_folder.id

    def build_structure(items, parent_id):
        for item in items:
            folder_id = ensure_folder(item["name"], parent_id)
            children = item.get("children")
            if children:
                build_structure(children, folder_id)

    build_structure(resolved_structure, None)

    if created_any:
        logger.info("Created default Document Vault folders for user %s", owner_id)
        db.commit()
    return created_any
