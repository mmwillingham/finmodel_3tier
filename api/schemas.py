from pydantic import BaseModel, Field, ConfigDict, field_validator
import re
from typing import List, Optional, Any
from datetime import datetime

# --- USER SCHEMAS ---

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v

class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime
    is_confirmed: bool = False # NEW FIELD
    is_admin: bool = False # NEW FIELD
    model_config = ConfigDict(from_attributes=True)

class TokenData(BaseModel):
    """Schema for the data payload extracted from the JWT."""
    email: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator('new_password')
    @classmethod
    def validate_new_password_complexity(cls, v: str) -> str:
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('New password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('New password must contain at least one number')
        return v

class PasswordResetRequest(BaseModel):
    email: str

class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

    @field_validator('new_password')
    @classmethod
    def validate_new_password_complexity(cls, v: str) -> str:
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('New password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('New password must contain at least one number')
        return v

class EmailConfirmation(BaseModel):
    token: str

class UserAdminStatusUpdate(BaseModel):
    is_admin: bool

class CategoryUsageCheck(BaseModel):
    category_name: str
    category_type: str # e.g., 'asset', 'liability', 'income', 'expense'

# --- CALCULATION INPUT SCHEMAS ---

# 🛑 NEW: Schema for a single account sent by the frontend
class AccountSchema(BaseModel):
    name: str
    type: str
    initial_balance: float
    monthly_contribution: float
    annual_increase_percent: float # NOTE: Must be a float
    annual_change_type: str = "increase"

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
    person1_first_name: str | None = "Person 1"
    person1_last_name: str | None = ""
    person1_birthdate: str | None = None
    person1_cell_phone: str | None = None
    person2_first_name: str | None = "Person 2"
    person2_last_name: str | None = ""
    person2_birthdate: str | None = None
    person2_cell_phone: str | None = None
    address: str | None = ""
    city: str | None = ""
    state: str | None = ""
    zip_code: str | None = ""
    email: str | None = ""
    projection_years: int | None = 30
    show_chart_totals: bool | None = True # New field
    model_config = ConfigDict(from_attributes=True)

class UserSettingsUpdate(BaseModel):
    default_inflation_percent: float
    asset_categories: str | None = None
    liability_categories: str | None = None
    income_categories: str | None = None
    expense_categories: str | None = None
    person1_first_name: str | None = None
    person1_last_name: str | None = None
    person1_birthdate: str | None = None
    person1_cell_phone: str | None = None
    person2_first_name: str | None = None
    person2_last_name: str | None = None
    person2_birthdate: str | None = None
    person2_cell_phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    email: str | None = None
    projection_years: int | None = None
    show_chart_totals: bool | None = True # New field


# --- ASSET SCHEMAS ---

class AssetCreate(BaseModel):
    name: str
    category: str
    value: float
    annual_increase_percent: float = 0.0
    annual_change_type: str = "increase" # New field
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
    annual_change_type: str # New field
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    model_config = ConfigDict(from_attributes=True)


# --- LIABILITY SCHEMAS ---

class LiabilityCreate(BaseModel):
    name: str
    category: str
    value: float
    annual_increase_percent: float = 0.0
    annual_change_type: str = "increase" # New field
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
    annual_change_type: str # New field
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    model_config = ConfigDict(from_attributes=True)

# --- CUSTOM CHART SCHEMAS ---

class CustomChartBase(BaseModel):
    name: str
    chart_type: str
    display_type: str = "chart" # New field for chart/table display options
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
    updated_at: datetime | None = None
    display_type: str # Inherited from CustomChartBase but explicitly listed for clarity
    model_config = ConfigDict(from_attributes=True)
