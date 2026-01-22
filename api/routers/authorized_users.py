from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import auth
import database
from schemas_authorized_users import (
    AuthorizedUserCreate, AuthorizedUserUpdate, AuthorizedUserOut
)
from utils.permissions import get_authorized_users_for_primary
from utils.email import send_email
from config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/authorized-users",
    tags=["authorized-users"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=AuthorizedUserOut, status_code=status.HTTP_201_CREATED)
def create_authorized_user(
    authorized_user: AuthorizedUserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Create a new authorized user entry.
    The current user (primary_user) grants access to another user (authorized_user).
    If the user doesn't exist yet:
    - If temporary_password is provided, the user account will be created immediately
    - Otherwise, create the entry with just the email (authorized_user_id will be null).
      When they register, they'll be automatically linked.
    """
    # Find the authorized user by email
    target_user = db.query(models.User).filter(
        models.User.email == authorized_user.authorized_user_email.lower()
    ).first()
    
    # If user doesn't exist and temporary_password is provided, create the user account
    if not target_user and authorized_user.temporary_password:
        try:
            hashed_password = auth.get_password_hash(authorized_user.temporary_password)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password did not meet requirements: {e}"
            )
        
        # Create the user account
        target_user = models.User(
            email=authorized_user.authorized_user_email.lower(),
            hashed_password=hashed_password,
            is_active=True,
            is_confirmed=True,  # Auto-confirm since they're being invited
            must_change_password=True,  # Require password change on first login
            referred_by_id=None
        )
        
        db.add(target_user)
        db.commit()
        db.refresh(target_user)
        
        # Initialize UserSettings with defaults
        user_settings = models.UserSettings(owner_id=target_user.id)
        db.add(user_settings)
        db.commit()
        
        logger.info(f"Created user account for {authorized_user.authorized_user_email} (user_id: {target_user.id})")
    
    # Cannot authorize yourself
    if target_user and target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot authorize yourself"
        )
    
    # Check if this authorization already exists (by email if user doesn't exist, by user_id if they do)
    if target_user:
        existing = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.primary_user_id == current_user.id,
            models.AuthorizedUser.authorized_user_id == target_user.id
        ).first()
    else:
        existing = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.primary_user_id == current_user.id,
            models.AuthorizedUser.authorized_user_email == authorized_user.authorized_user_email.lower(),
            models.AuthorizedUser.authorized_user_id.is_(None)
        ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already authorized"
        )
    
    # Create the authorized user entry
    # If user exists (or was just created), link them. If not, authorized_user_id will be None until they register
    db_authorized_user = models.AuthorizedUser(
        primary_user_id=current_user.id,
        authorized_user_id=target_user.id if target_user else None,
        authorized_user_email=authorized_user.authorized_user_email.lower(),
        financial_data_permission=authorized_user.financial_data_permission,
        document_vault_permission=authorized_user.document_vault_permission
    )
    
    db.add(db_authorized_user)
    db.commit()
    db.refresh(db_authorized_user)
    
    logger.info(f"Created authorized user entry for {authorized_user.authorized_user_email} (user_id: {target_user.id if target_user else 'pending'}) for primary user {current_user.id}")
    
    # Send email notification in the background
    try:
        primary_user_name = current_user.email.split('@')[0] if current_user.email else "User"
        login_link = f"{settings.FRONTEND_URL or 'https://www.ordaxium.com'}/login"
        
        email_subject = f"You've been granted access to {current_user.email or 'a user'}'s financial data"
        if target_user:
            if authorized_user.temporary_password:
                invitation_message = f"""Your account has been created! You can now log in to access their data.

Login credentials:
- Username/Email: {authorized_user.authorized_user_email}
- Temporary Password: {authorized_user.temporary_password}

Please log in at: {login_link}

You will be required to change your password on first login for security."""
            else:
                invitation_message = "Your account has been linked and you can now access their data."
        else:
            signup_link = f"{settings.FRONTEND_URL or 'https://www.ordaxium.com'}/signup"
            invitation_message = f"To accept this invitation and access their data, please sign up at:\n\n{signup_link}\n\nOnce you register with this email address, your access will be automatically activated."
        
        email_body = f"""Hello,

{primary_user_name} ({current_user.email or 'a user'}) has granted you access to their financial data in {settings.APP_NAME}.

{invitation_message}

Permissions granted:
- Financial Data (Accounts, Items, Projections, Charts): {authorized_user.financial_data_permission or 'None'}
- Document Vault: {authorized_user.document_vault_permission or 'None'}

Thank you!
The {settings.APP_NAME} Team
        """.strip()
        
        background_tasks.add_task(send_email, authorized_user.authorized_user_email, email_subject, email_body)
        logger.info(f"Queued authorized user email to {authorized_user.authorized_user_email}")
    except Exception as e:
        logger.error(f"Failed to queue authorized user email to {authorized_user.authorized_user_email}: {e}", exc_info=True)
    
    return db_authorized_user


@router.get("/", response_model=List[AuthorizedUserOut])
def list_authorized_users(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    List all users authorized by the current user (primary user).
    """
    authorized_users = get_authorized_users_for_primary(db, current_user.id)
    
    # Return as dicts with all fields for frontend compatibility
    result = []
    for user in authorized_users:
        user_dict = {
            "id": user.id,
            "primary_user_id": user.primary_user_id,
            "authorized_user_id": user.authorized_user_id,
            "authorized_user_email": user.authorized_user_email,
            "financial_data_permission": user.financial_data_permission,
            "document_vault_permission": user.document_vault_permission,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
        result.append(user_dict)
    
    return result


@router.get("/received")
def list_authorized_access_received(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    List all primary users that have granted access to the current user.
    Returns dicts with primary_user_email included (not using AuthorizedUserOut schema).
    """
    authorized_access = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.authorized_user_id == current_user.id
    ).all()
    
    # Add primary_user_email to each response
    result = []
    for access in authorized_access:
        primary_user = db.query(models.User).filter(models.User.id == access.primary_user_id).first()
        access_dict = {
            "id": access.id,
            "primary_user_id": access.primary_user_id,
            "authorized_user_id": access.authorized_user_id,
            "authorized_user_email": access.authorized_user_email,
            "primary_user_email": primary_user.email if primary_user else None,
            "financial_data_permission": access.financial_data_permission,
            "document_vault_permission": access.document_vault_permission,
            "created_at": access.created_at,
            "updated_at": access.updated_at,
        }
        result.append(access_dict)
    
    return result


@router.get("/{authorized_user_id}", response_model=AuthorizedUserOut)
def get_authorized_user(
    authorized_user_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get a specific authorized user entry by ID.
    """
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == authorized_user_id,
        models.AuthorizedUser.primary_user_id == current_user.id
    ).first()
    
    if not authorized_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized user not found"
        )
    
    return authorized_user


@router.put("/{authorized_user_id}", response_model=AuthorizedUserOut)
def update_authorized_user(
    authorized_user_id: int,
    authorized_user_update: AuthorizedUserUpdate,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Update permissions for an authorized user.
    """
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == authorized_user_id,
        models.AuthorizedUser.primary_user_id == current_user.id
    ).first()
    
    if not authorized_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized user not found"
        )
    
    # Update permissions - use model_dump to get only fields that were explicitly set
    # This allows clearing permissions by setting them to None
    update_data = authorized_user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(authorized_user, key, value)
    
    db.commit()
    db.refresh(authorized_user)
    
    logger.info(f"Updated authorized user {authorized_user_id} for primary user {current_user.id}")
    return authorized_user


@router.delete("/{authorized_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_authorized_user(
    authorized_user_id: int,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Remove authorization for a user.
    """
    authorized_user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == authorized_user_id,
        models.AuthorizedUser.primary_user_id == current_user.id
    ).first()
    
    if not authorized_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authorized user not found"
        )
    
    db.delete(authorized_user)
    db.commit()
    
    logger.info(f"Deleted authorized user {authorized_user_id} for primary user {current_user.id}")
    return None

