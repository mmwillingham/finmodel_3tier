from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from . import models, database, schemas # Ensure schemas is imported

# --- CONFIGURATION ---
# SECRET_KEY = "your-very-secret-key-that-should-be-in-an-env-file"
# ALGORITHM = "HS256"
# ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- PASSWORD HASHING ---
pwd_context = CryptContext(schemes=["scrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a plaintext password."""
    return pwd_context.hash(password)

# --- USER LOOKUP AND AUTHENTICATION ---

def get_user(db: Session, email: str):
    """Retrieves a user model by email."""
    # Ensure this returns the SQLAlchemy model (models.User)
    return db.query(models.User).filter(models.User.email == email).first()

def authenticate_user(db: Session, email: str, password: str):
    """Looks up user by email and verifies the password."""
    user = get_user(db, email=email)
    if not user:
        return False
    
    if not verify_password(password, user.hashed_password):
        return False
        
    return user

# --- JWT TOKEN FUNCTIONS ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a JWT access token with optional expiration."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=main.ALGORITHM)
    return encoded_jwt

def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    """
    Dependency function to retrieve the current authenticated user from the JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Extract the subject (user email)
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        # Use the TokenData schema to validate the payload structure
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    # Look up the user in the database
    user = get_user(db, email=token_data.email)
    if user is None:
        raise credentials_exception
        
    return user # <--- Returns SQLAlchemy User model, which is validated against schemas.UserOut
