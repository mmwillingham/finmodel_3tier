from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# --- USER SCHEMAS (Pydantic Models) ---

class UserBase(BaseModel):
    """Base schema for user data, containing non-sensitive fields."""
    email: str

class UserCreate(UserBase):
    """Schema for creating a new user (includes password)."""
    password: str

class UserOut(UserBase):
    """Schema for returning user data (response model)."""
    id: int
    
    # Allows Pydantic to read ORM attributes (e.g., user.id) directly
    class Config:
        from_attributes = True 

# --- CALCULATION INPUT SCHEMAS ---

class ProjectionRequest(BaseModel):
    """
    Schema for the data submitted by the Calculator component 
    to the POST /projections endpoint.
    """
    plan_name: str
    starting_capital: float
    monthly_contribution: float
    annual_return_rate: float
    years: int
    
    # Example: Allowing optional extra accounts data, which should be a list of dicts/schemas
    # For simplicity, we keep it as Any for flexible input to calculations.py
    extra_accounts: Optional[List[dict]] = [] 

    class Config:
        from_attributes = True

# --- CALCULATION OUTPUT SCHEMAS ---

class ProjectionDataPoint(BaseModel):
    """
    Schema for a single row/point in the calculated projection data (from pandas DataFrame).
    """
    Year: int
    StartingValue: float
    Contributions: float
    Growth: float
    Value: float
    
    # Allow other fields from the DataFrame if needed
    
    class Config:
        from_attributes = True

class ProjectionResponse(BaseModel):
    """
    Schema for the response returned by the GET/POST /projections endpoints.
    """
    id: int
    name: str
    years: int
    final_value: float
    
    # The actual calculation results (list of data points)
    projection_data: List[ProjectionDataPoint] # Changed from List[Any] to a list of the data points

    class Config:
        from_attributes = True
