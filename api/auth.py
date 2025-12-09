# api/auth.py

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from . import models, schemas, database
from .config import settings # 🌟 NEW: Import settings from the central config file

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

def get_current_active_user(current_user: schemas.UserOut = Depends(get_current_user)):
    # This is a placeholder for checking activation status if needed
    # if not current_user.is_active: 
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
