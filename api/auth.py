# api/auth.py

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import secrets
import string

import models
import schemas
import database
from config import settings

from passlib.context import CryptContext

# Define the password hashing context
pwd_context = CryptContext(schemes=["scrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Generates a secure scrypt hash of the password."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a stored scrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_mfa_token(user_id: int, expires_delta: timedelta):
    """Creates a short-lived token specifically for the MFA verification step."""
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire, "mfa": True}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    try:
        # If no token exists, return None (guest) instead of an error
        if not token or token == "undefined":
            return None
            
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
            
        # Match the schema change here
        token_data = schemas.TokenData(user_id=user_id) 
    except (JWTError, ValueError):
        return None 
    
    user = db.query(models.User).filter(models.User.id == int(token_data.user_id)).first()
    return user

def get_current_admin_user(current_user: models.User = Depends(get_current_user)):
    """Dependency to restrict access to admin users only."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges"
        )
    return current_user

def generate_random_token(length: int = 32) -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def create_email_confirmation_token(db: Session, user_id: int) -> str:
    db.query(models.EmailConfirmationToken).filter(models.EmailConfirmationToken.user_id == user_id).delete()
    db.commit()

    token_value = generate_random_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    db_token = models.EmailConfirmationToken(
        user_id=user_id,
        token=token_value,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return token_value

def verify_email_confirmation_token(db: Session, token: str):
    db_token = db.query(models.EmailConfirmationToken).filter(models.EmailConfirmationToken.token == token).first()

    if not db_token:
        return None

    if db_token.expires_at < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        return None
    
    user_id = db_token.user_id
    db.delete(db_token)
    db.commit()
    return user_id

def authenticate_or_create_google_user(db: Session, google_id: str, email: str):
    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_id = google_id
            # Ensure migrating Google users are confirmed
            user.is_confirmed = True 
        else:
            user = models.User(
                email=email,
                google_id=google_id,
                hashed_password=get_password_hash(generate_random_token()),
                is_active=True,
                is_confirmed=True  # Google users are pre-verified
            )
            db.add(user)
        db.commit()
        db.refresh(user)
    return user

# auth.py (Add logic to support migration)

def initiate_email_change(db: Session, user_id: int, new_email: str):
    # 1. Check if the new email is already taken by someone else
    existing_user = get_user_by_email(db, new_email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already in use.")
    
    # 2. Update the user record
    # Note: We set is_confirmed to False so they must verify it before full MFA access
    user = get_user(db, user_id)
    user.email = new_email
    user.is_confirmed = False
    db.commit()
    
    # 3. Create a new confirmation token
    token = create_email_confirmation_token(db, user.id)
    return token