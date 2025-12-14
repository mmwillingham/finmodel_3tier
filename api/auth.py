# api/auth.py

from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import secrets # New import for token generation
import string # New import for token generation

import models
import schemas
import database
from config import settings # 🌟 NEW: Import settings from the central config file

from passlib.context import CryptContext
# Define the context
pwd_context = CryptContext(schemes=["scrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Generates a secure scrypt hash of the password."""
    # We remove the 72-byte truncation because scrypt handles long passwords.
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a stored scrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)
    

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({"exp": expire})
    
    # Use the central settings object for key and algorithm
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, # 🌟 FIXED
        algorithm=settings.ALGORITHM # 🌟 FIXED
    )
    return encoded_jwt

def get_user(db: Session, user_id: int):
    # Retrieve user from the database
    return db.query(models.User).filter(models.User.id == user_id).first()

def authenticate_user(db: Session, username: str, password: str):
    # This is where you would lookup the user and verify the password hash
    user = db.query(models.User).filter(models.User.email == username).first()
    if not user:
        return False

    if not verify_password(password, user.hashed_password):
        return False
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, # 🌟 FIXED
            algorithms=[settings.ALGORITHM] # 🌟 FIXED
        )
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = get_user(db, user_id=user_id)
    if user is None:
        raise credentials_exception
    # Convert models.User object to the Pydantic schema for consistency
    return schemas.UserOut.model_validate(user)

def authenticate_or_create_google_user(db: Session, google_id: str, email: str):
    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if user:
        # User found by google_id, return them
        return user

    # If not found by google_id, check by email
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        if not user.google_id:
            # Existing email user, link google_id
            user.google_id = google_id
            user.is_confirmed = True # Confirm email if logging in via Google
            db.commit()
            db.refresh(user)
        return user
    
    # If no user found by google_id or email, create a new one
    # For Google OAuth users, we don't have a password in our system.
    # Create a dummy/unusable hashed password if your schema requires it, or make it nullable.
    # For now, we'll create an unusable one.
    dummy_hashed_password = get_password_hash(secrets.token_urlsafe(32)) # Generate a random, strong dummy password

    new_user = models.User(
        email=email,
        hashed_password=dummy_hashed_password,
        is_active=True,
        is_confirmed=True, # Google users are considered confirmed
        google_id=google_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

def get_current_active_user(current_user: schemas.UserOut = Depends(get_current_user)):
    # This is a placeholder for checking activation status if needed
    # if not current_user.is_active: 
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_admin_user(current_user: schemas.UserOut = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return current_user

def change_user_password(db: Session, user_id: int, current_password: str, new_password: str):
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect current password")
    
    hashed_new_password = get_password_hash(new_password)
    user.hashed_password = hashed_new_password
    db.commit()
    db.refresh(user)
    return user

def generate_random_token(length: int = 32) -> str:
    charset = string.ascii_letters + string.digits
    return ''.join(secrets.choice(charset) for i in range(length))

def create_password_reset_token(db: Session, user_id: int) -> str:
    # Invalidate any existing tokens for this user
    db.query(models.PasswordResetToken).filter(models.PasswordResetToken.user_id == user_id).delete()
    db.commit()

    token_value = generate_random_token()
    expires_at = datetime.utcnow() + timedelta(hours=1) # Token valid for 1 hour

    db_token = models.PasswordResetToken(
        user_id=user_id,
        token=token_value,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return token_value

def reset_user_password(db: Session, token: str, new_password: str):
    db_token = db.query(models.PasswordResetToken).filter(models.PasswordResetToken.token == token).first()

    if not db_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token.")

    if db_token.expires_at < datetime.utcnow():
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token.")
    
    user = get_user(db, db_token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    hashed_new_password = get_password_hash(new_password)
    user.hashed_password = hashed_new_password
    user.is_confirmed = True # NEW: Confirm email upon successful password reset
    db.delete(db_token) # Invalidate the token after use
    db.commit()
    db.refresh(user)
    return user

def create_email_confirmation_token(db: Session, user_id: int) -> str:
    # Invalidate any existing confirmation tokens for this user
    db.query(models.EmailConfirmationToken).filter(models.EmailConfirmationToken.user_id == user_id).delete()
    db.commit()

    token_value = generate_random_token()
    expires_at = datetime.utcnow() + timedelta(hours=24) # Token valid for 24 hours

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired confirmation token.")

    if db_token.expires_at < datetime.utcnow():
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired confirmation token.")
    
    user = get_user(db, db_token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User associated with token not found.")

    user.is_confirmed = True
    db.delete(db_token) # Invalidate the token after use
    db.commit()
    db.refresh(user)
    return user
