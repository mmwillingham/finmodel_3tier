from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
from datetime import datetime

# --- USER SCHEMAS ---

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

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
    total_contributed: float
    total_growth: float
    # CRITICAL FIX: The response schema must use the model's attribute name
    data_json: str
    timestamp: Optional[datetime] = None  # Optional for backward compatibility with existing records
    class Config:
        from_attributes = True

class ProjectionOut(BaseModel):
    id: int
    name: str
    years: int
    final_value: float | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

class ProjectionDetailOut(BaseModel):
    id: int
    name: str
    years: int
    final_value: float | None = None
    total_contributed: float | None = None
    total_growth: float | None = None
    data_json: str | None = None
    accounts_json: str | None = None
    model_config = ConfigDict(from_attributes=True)

# --- CASH FLOW SCHEMAS ---

class CashFlowBase(BaseModel):
    is_income: bool
    category: str
    description: str
    frequency: str  # 'monthly' | 'yearly'
    value: float     # raw user-entered number

class CashFlowCreate(BaseModel):
    is_income: bool
    category: str
    description: str
    frequency: str
    value: float
    annual_increase_percent: float = 0.0
    inflation_percent: float = 0.0
    person: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    taxable: bool = False
    tax_deductible: bool = False

class CashFlowUpdate(CashFlowCreate):
    pass

class CashFlowOut(BaseModel):
    id: int
    is_income: bool
    category: str
    description: str
    frequency: str
    yearly_value: float
    annual_increase_percent: float
    inflation_percent: float
    person: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    taxable: bool
    tax_deductible: bool
    model_config = ConfigDict(from_attributes=True)

class UserSettingsOut(BaseModel):
    id: int
    user_id: int
    default_inflation_percent: float
    asset_categories: str | None = "Real Estate,Vehicles,Investments,Other"
    liability_categories: str | None = "Mortgage,Car Loan,Credit Card,Student Loan,Other"
    income_categories: str | None = "Salary,Bonus,Investment Income,Other"
    expense_categories: str | None = "Housing,Transportation,Food,Healthcare,Entertainment,Other"
    person1_name: str | None = "Person 1"
    person2_name: str | None = "Person 2"
    projection_years: int | None = 30
    show_chart_totals: bool | None = True # New field
    model_config = ConfigDict(from_attributes=True)

class UserSettingsUpdate(BaseModel):
    default_inflation_percent: float
    asset_categories: str | None = None
    liability_categories: str | None = None
    income_categories: str | None = None
    expense_categories: str | None = None
    person1_name: str | None = None
    person2_name: str | None = None
    projection_years: int | None = None
    show_chart_totals: bool | None = True # New field


# --- ASSET SCHEMAS ---

class AssetCreate(BaseModel):
    name: str
    category: str
    value: float
    annual_increase_percent: float = 0.0
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field

class AssetUpdate(AssetCreate):
    pass

class AssetOut(BaseModel):
    id: int
    name: str
    category: str
    value: float
    annual_increase_percent: float
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    model_config = ConfigDict(from_attributes=True)


# --- LIABILITY SCHEMAS ---

class LiabilityCreate(BaseModel):
    name: str
    category: str
    value: float
    annual_increase_percent: float = 0.0
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field

class LiabilityUpdate(LiabilityCreate):
    pass

class LiabilityOut(BaseModel):
    id: int
    name: str
    category: str
    value: float
    annual_increase_percent: float
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    model_config = ConfigDict(from_attributes=True)

# --- CUSTOM CHART SCHEMAS ---

class CustomChartBase(BaseModel):
    name: str
    chart_type: str
    data_sources: str | None = None # Comma-separated string like "assets,liabilities"
    series_configurations: str       # JSON string
    x_axis_label: str | None = None
    y_axis_label: str | None = None

class CustomChartCreate(CustomChartBase):
    pass

class CustomChartUpdate(CustomChartBase):
    pass

class CustomChartOut(CustomChartBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
