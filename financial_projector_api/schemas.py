from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# --- USER SCHEMAS ---

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    
    class Config:
        from_attributes = True 

class TokenData(BaseModel):
    """Schema for the data payload extracted from the JWT."""
    email: Optional[str] = None

# --- CALCULATION INPUT SCHEMAS ---

# 🛑 NEW: Schema for a single account sent by the frontend
class AccountSchema(BaseModel):
    name: str
    type: str
    initial_balance: float
    monthly_contribution: float
    annual_rate_percent: float # NOTE: Must be a float

class ProjectionRequest(BaseModel):
    """
    Schema now accepts the list of accounts from the frontend.
    """
    plan_name: str
    years: int
    accounts: List[AccountSchema] # <--- CRITICAL CHANGE
    
    class Config:
        from_attributes = True

# --- CALCULATION OUTPUT SCHEMAS ---

class ProjectionDataPoint(BaseModel):
    Year: int
    StartingValue: float
    Contributions: float
    Growth: float
    Value: float
    
    class Config:
        from_attributes = True

class ProjectionResponse(BaseModel):
    id: int
    name: str
    years: int
    final_value: float
    projection_data: List[ProjectionDataPoint] 

    class Config:
        from_attributes = True
