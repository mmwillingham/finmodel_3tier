from fastapi import APIRouter, Depends, HTTPException, status
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
    db: Session = Depends(database.get_db),
    current_user: schemas.UserOut = Depends(auth.get_current_user)
):
    """
    Create a new referral entry.
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
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already registered."
        )
    
    new_referral = models.Referral(
        referrer_id=current_user.id,
        friend_name=referral.friend_name,
        friend_email=referral.friend_email.lower(),
    )
    
    db.add(new_referral)
    db.commit()
    db.refresh(new_referral)
    
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

