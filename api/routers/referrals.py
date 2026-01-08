from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from pydantic import BaseModel
from pydantic import ConfigDict
from datetime import datetime
import models
import schemas
import auth
import database
import logging
from utils.email import send_email
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/referrals",
    tags=["referrals"],
    responses={404: {"description": "Not found"}},
)

class ReferralCreate(BaseModel):
    friend_name: str
    friend_email: str

class ReferralOut(BaseModel):
    id: int
    friend_name: str
    friend_email: str
    registered_user_id: int | None
    registered_at: datetime | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=ReferralOut, status_code=status.HTTP_201_CREATED)
def create_referral(
    referral: ReferralCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Create a new referral entry. If the email is already registered, link them to the referral.
    """
    # Check if this email was already referred by this user
    existing = db.query(models.Referral).filter(
        models.Referral.referrer_id == current_user.id,
        models.Referral.friend_email == referral.friend_email.lower()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already referred this email address."
        )
    
    # Check if this email is already a registered user
    existing_user = db.query(models.User).filter(
        models.User.email == referral.friend_email.lower()
    ).first()
    
    # Create the referral entry
    new_referral = models.Referral(
        referrer_id=current_user.id,
        friend_name=referral.friend_name,
        friend_email=referral.friend_email.lower(),
    )
    
    # If the user already exists, link them to the referral
    if existing_user:
        new_referral.registered_user_id = existing_user.id
        new_referral.registered_at = datetime.now()
        # Also set the user's referred_by_id if not already set
        if not existing_user.referred_by_id:
            existing_user.referred_by_id = current_user.id
    
    db.add(new_referral)
    db.commit()
    db.refresh(new_referral)
    
    # Send email notification in the background
    try:
        referrer_name = current_user.email.split('@')[0]  # Use email username as name
        referral_link = f"{settings.FRONTEND_URL or 'https://ordaxium.com'}/signup?ref={current_user.id}"
        
        email_subject = f"You've been referred to {settings.APP_NAME}"
        email_body = f"""Hello {referral.friend_name},

{referrer_name} has referred you to {settings.APP_NAME}!

{"You're already registered, and we've linked your account to this referral." if existing_user else f"Click the link below to sign up and get started:\n\n{referral_link}"}

Thank you!
The {settings.APP_NAME} Team
        """.strip()
        
        background_tasks.add_task(send_email, referral.friend_email, email_subject, email_body)
        logger.info(f"Queued referral email to {referral.friend_email}")
    except Exception as e:
        logger.error(f"Failed to queue referral email to {referral.friend_email}: {e}", exc_info=True)
    
    return new_referral

@router.get("/", response_model=List[ReferralOut])
def get_my_referrals(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get all referrals made by the current user.
    """
    referrals = db.query(models.Referral).filter(
        models.Referral.referrer_id == current_user.id
    ).order_by(models.Referral.created_at.desc()).all()
    
    return referrals

@router.get("/stats", response_model=dict)
def get_referral_stats(
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Get referral statistics for the current user.
    """
    total_referrals = db.query(func.count(models.Referral.id)).filter(
        models.Referral.referrer_id == current_user.id
    ).scalar()
    
    registered_referrals = db.query(func.count(models.Referral.id)).filter(
        models.Referral.referrer_id == current_user.id,
        models.Referral.registered_user_id.isnot(None)
    ).scalar()
    
    return {
        "total_referrals": total_referrals or 0,
        "registered_referrals": registered_referrals or 0,
        "pending_referrals": (total_referrals or 0) - (registered_referrals or 0)
    }

