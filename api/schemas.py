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
    linked_item_id: Optional[int] = None
    linked_item_type: Optional[str] = None
    percentage: Optional[float] = None
    linked_item_id: Optional[int] = None
    linked_item_type: Optional[str] = None
    percentage: Optional[float] = None

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
    linked_item_id: Optional[int] = None
    linked_item_type: Optional[str] = None
    percentage: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class UserSettingsBase(BaseModel):
    default_inflation_percent: float = 2.0
    asset_categories: List[str] = ["Other", "Checking", "Savings", "Investment"]
    liability_categories: List[str] = ["Other", "Mortgage", "Student Loan", "Car Loan"]
    income_categories: List[str] = ["Salary", "Rental Income", "Investments"]
    expense_categories: List[str] = ["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
    person1_first_name: str = "Person 1"
    person1_last_name: str = ""
    person1_birthdate: str = ""
    person1_cell_phone: str = ""
    person2_first_name: str = "Person 2"
    person2_last_name: str = ""
    person2_birthdate: str = ""
    person2_cell_phone: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    email: str = ""
    projection_years: int = 30
    show_chart_totals: bool = True

class UserSettingsCreate(UserSettingsBase):
    pass

class UserSettingsUpdate(BaseModel):
    default_inflation_percent: Optional[float] = None
    asset_categories: Optional[List[str]] = None
    liability_categories: Optional[List[str]] = None
    income_categories: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    person1_first_name: Optional[str] = None
    person1_last_name: Optional[str] = None
    person1_birthdate: Optional[str] = None
    person1_cell_phone: Optional[str] = None
    person2_first_name: Optional[str] = None
    person2_last_name: Optional[str] = None
    person2_birthdate: Optional[str] = None
    person2_cell_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    email: Optional[str] = None
    projection_years: Optional[int] = None
    show_chart_totals: Optional[bool] = None

class UserSettingsOut(UserSettingsBase):
    id: int
    owner_id: int # Changed from user_id to owner_id
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


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
    loan_type: str = "ordinary" # NEW
    principal_amount: Optional[float] = None # NEW
    interest_rate: Optional[float] = None # NEW
    loan_term_months: Optional[int] = None # NEW
    loan_start_date: Optional[datetime] = None # NEW
    monthly_payment: Optional[float] = None # NEW
    fees: Optional[float] = 0.0 # NEW
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
    loan_type: str # NEW
    principal_amount: Optional[float] = None # NEW
    interest_rate: Optional[float] = None # NEW
    loan_term_months: Optional[int] = None # NEW
    loan_start_date: Optional[datetime] = None # NEW
    monthly_payment: Optional[float] = None # NEW
    fees: float # NEW
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    model_config = ConfigDict(from_attributes=True)

# --- CUSTOM CHART SCHEMAS ---

class CustomChartBase(BaseModel):
    name: str
    chart_type: str
    display_type: Optional[str] = None # New field for chart/table display options
    data_sources: str | None = None # Comma-separated string like "assets,liabilities"
    series_configurations: str       # JSON string
    x_axis_label: str | None = None
    y_axis_label: str | None = None
    # New fields for storing calculated projection results
    data_json: str | None = None
    final_value: float | None = None
    total_contributed: float | None = None
    total_growth: float | None = None

class CustomChartCreate(CustomChartBase):
    pass

class CustomChartUpdate(CustomChartBase):
    pass

class CustomChartOut(CustomChartBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime | None = None
    display_type: Optional[str] = None # NEW: display type for the chart
    # These are inherited from CustomChartBase but explicitly listed for clarity
    data_json: str | None = None
    final_value: float | None = None
    total_contributed: float | None = None
    total_growth: float | None = None
    model_config = ConfigDict(from_attributes=True)
