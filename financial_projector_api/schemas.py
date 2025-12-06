from pydantic import BaseModel, EmailStr
from typing import Optional, List
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime

# --- User Schemas ---

class UserBase(BaseModel):
    """Base schema for user data."""
    email: EmailStr

class UserCreate(UserBase):
    """Schema for user registration (includes password)."""
    password: str

class User(UserBase):
    """Schema for retrieving an existing user (response)."""
    id: int
    is_active: bool

    class Config:
        # Allows Pydantic to read data directly from SQLAlchemy models
        from_attributes = True 

# --- Authentication Schemas ---

class Token(BaseModel):
    """Schema for the JWT token returned upon successful login."""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Internal schema for decoding JWT payload."""
    email: Optional[str] = None

# --- Projection Schemas (Input/Output) ---

# Schema for the inputs of a single account within the projection
class AccountInput(BaseModel):
    name: str
    type: str 
    initial_balance: float
    monthly_contribution: float
    annual_rate_percent: float

# Schema for the full projection request sent from the front-end
class ProjectionRequest(BaseModel):
    projection_name: str
    years: int
    accounts: List[AccountInput]

# Schema for a summary row in the Dashboard (GET /projections)
class ProjectionSummary(BaseModel):
    id: int
    name: str
    years: int
    timestamp: datetime
    final_value: float # Extracted from data_json for quick display
    total_contributed: float # Extracted from data_json for quick display

    class Config:
        from_attributes = True

# Schema for the detailed response when viewing a single projection (GET /projections/{id} or POST /projections)
class ProjectionResponse(BaseModel):
    id: int
    name: str
    years: int
    final_value: float
    # projection_data is a dictionary containing the full yearly breakdown and original inputs (parsed from JSON string)
    projection_data: dict
