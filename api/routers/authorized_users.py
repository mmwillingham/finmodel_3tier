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
    If the user doesn't exist yet, create the entry with just the email (authorized_user_id will be null).
    When they register, they'll be automatically linked.
    """
    # Find the authorized user by email
    target_user = db.query(models.User).filter(
        models.User.email == authorized_user.authorized_user_email.lower()
    ).first()
    
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
    # If user exists, link them. If not, authorized_user_id will be None until they register
    db_authorized_user = models.AuthorizedUser(
        primary_user_id=current_user.id,
        authorized_user_id=target_user.id if target_user else None,
        authorized_user_email=authorized_user.authorized_user_email.lower(),
        accounts_permission=authorized_user.accounts_permission,
        items_permission=authorized_user.items_permission,
        projections_permission=authorized_user.projections_permission,
        charts_permission=authorized_user.charts_permission,
        documents_permission=authorized_user.documents_permission
    )
    
    db.add(db_authorized_user)
    db.commit()
    db.refresh(db_authorized_user)
    
    logger.info(f"Created authorized user entry for {authorized_user.authorized_user_email} (user_id: {target_user.id if target_user else 'pending'}) for primary user {current_user.id}")
    
    # Send email notification in the background
    try:
        primary_user_name = current_user.email.split('@')[0]
        signup_link = f"{settings.FRONTEND_URL or 'https://www.ordaxium.com'}/signup"
        
        email_subject = f"You've been granted access to {current_user.email}'s financial data"
        if target_user:
            invitation_message = "Your account has been linked and you can now access their data."
        else:
            invitation_message = f"To accept this invitation and access their data, please sign up at:\n\n{signup_link}\n\nOnce you register with this email address, your access will be automatically activated."
        
        email_body = f"""Hello,

{primary_user_name} ({current_user.email}) has granted you access to their financial data in {settings.APP_NAME}.

{invitation_message}

Permissions granted:
- Accounts: {authorized_user.accounts_permission or 'None'}
- Items (Assets/Liabilities/Income/Expenses): {authorized_user.items_permission or 'None'}
- Projections: {authorized_user.projections_permission or 'None'}
- Charts: {authorized_user.charts_permission or 'None'}
- Documents: {authorized_user.documents_permission or 'None'}

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
            "accounts_permission": user.accounts_permission,
            "items_permission": user.items_permission,
            "projections_permission": user.projections_permission,
            "charts_permission": user.charts_permission,
            "documents_permission": user.documents_permission,
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
            "accounts_permission": access.accounts_permission,
            "items_permission": access.items_permission,
            "projections_permission": access.projections_permission,
            "charts_permission": access.charts_permission,
            "documents_permission": access.documents_permission,
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

