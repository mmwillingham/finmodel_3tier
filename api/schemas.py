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

# --- NEW PROJECTION MODELS FOR REARCHITECTURE ---

class ProjectedAccountBase(BaseModel):
    name: str
    account_type: str
    initial_value: float
    contribution: float
    growth_rate: float
    # NEW fields for amortized loans
    loan_type: Optional[str] = None  # "ordinary" or "amortized"
    principal_amount: Optional[float] = None
    interest_rate: Optional[float] = None # Annual interest rate as percentage
    loan_term_months: Optional[int] = None
    loan_start_date: Optional[str] = None # YYYY-MM-DD format
    monthly_payment: Optional[float] = None # Calculated monthly payment


class ProjectedAccountCreate(ProjectedAccountBase):
    pass

class ProjectedAccountOut(ProjectedAccountBase):
    id: int
    projection_id: int
    model_config = ConfigDict(from_attributes=True)

class ProjectionTimeSeriesDataBase(BaseModel):
    year: int
    value_type: str
    value: float

class ProjectionTimeSeriesDataOut(ProjectionTimeSeriesDataBase):
    id: int
    projection_id: int
    account_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


# --- CALCULATION INPUT SCHEMAS ---

class ProjectionRequest(BaseModel):
    """
    Schema now accepts the list of ProjectedAccountCreate objects for its accounts.
    """
    plan_name: str
    years: int
    accounts: List[ProjectedAccountCreate] # <--- UPDATED TO NEW SCHEMA
    
    class Config:
        from_attributes = True

# --- CALCULATION OUTPUT SCHEMAS ---

class ProjectionResponse(BaseModel):
    id: int
    name: str
    years: int
    final_value: float
    total_contributed: float
    total_growth: float
    timestamp: Optional[datetime] = None
    accounts_data: List[ProjectedAccountOut] = [] # NEW
    time_series_data: List[ProjectionTimeSeriesDataOut] = [] # NEW
    data_json: Optional[str] = None  # NEW: Include data_json from calculations
    
    model_config = ConfigDict(from_attributes=True)

class ProjectionOut(BaseModel):
    id: int
    name: str
    years: int
    final_value: float | None = None
    total_contributed: float | None = None # NEW
    total_growth: float | None = None # NEW
    timestamp: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

class ProjectionDetailOut(BaseModel):
    id: int
    name: str
    years: int
    final_value: float | None = None
    total_contributed: float | None = None
    total_growth: float | None = None
    accounts_data: List[ProjectedAccountOut] = [] # NEW
    time_series_data: List[ProjectionTimeSeriesDataOut] = [] # NEW
    data_json: Optional[str] = None  # NEW: Include data_json (reconstructed from time_series_data if needed)
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
    contributes_to_asset_id: Optional[int] = None # NEW: For expense items that contribute to an asset

class CashFlowUpdate(BaseModel):
    is_income: Optional[bool] = None
    category: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    value: Optional[float] = None
    annual_increase_percent: Optional[float] = None
    inflation_percent: Optional[float] = None
    person: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    taxable: Optional[bool] = None
    tax_deductible: Optional[bool] = None
    linked_item_id: Optional[int] = None
    linked_item_type: Optional[str] = None
    percentage: Optional[float] = None
    contributes_to_asset_id: Optional[int] = None # NEW: For expense items that contribute to an asset

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
    contributes_to_asset_id: Optional[int] = None # NEW: For expense items that contribute to an asset
    model_config = ConfigDict(from_attributes=True)

class UserSettingsBase(BaseModel):
    default_inflation_percent: float = 2.0
    asset_categories: List[str] = ["Other", "Checking", "Savings", "Investment"]
    liability_categories: List[str] = ["Other", "Mortgage", "Student Loan", "Car Loan"]
    income_categories: List[str] = ["Salary", "Rental Income", "Investments"]
    expense_categories: List[str] = ["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
    person1_first_name: str = "Person 1"
    person1_last_name: str = ""
    person1_birthdate: Optional[str] = None # Make optional
    person1_cell_phone: Optional[str] = None # Make optional
    person2_first_name: str = "Person 2"
    person2_last_name: str = ""
    person2_birthdate: Optional[str] = None # Make optional
    person2_cell_phone: Optional[str] = None # Make optional
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    projection_years: int = 30
    show_chart_totals: bool = True
    surplus_asset_id: Optional[int] = None  # Designated asset for surplus/deficit

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
    projection_years: Optional[int] = None
    show_chart_totals: Optional[bool] = None
    surplus_asset_id: Optional[int] = None

class UserSettingsOut(UserSettingsBase):
    id: int
    owner_id: int # Changed from user_id to owner_id
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- GLOBAL SETTINGS SCHEMAS ---

class GlobalSettingsBase(BaseModel):
    asset_categories: List[str] = ["Other", "Checking", "Savings", "Investment"]
    liability_categories: List[str] = ["Other", "Mortgage", "Student Loan", "Car Loan"]
    income_categories: List[str] = ["Salary", "Rental Income", "Investments"]
    expense_categories: List[str] = ["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]

class GlobalSettingsCreate(GlobalSettingsBase):
    pass

class GlobalSettingsUpdate(BaseModel):
    asset_categories: Optional[List[str]] = None
    liability_categories: Optional[List[str]] = None
    income_categories: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    help_content: Optional[str] = None

class GlobalSettingsOut(GlobalSettingsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    help_content: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- ACCOUNT SCHEMAS ---

class AccountCreate(BaseModel):
    broker: str
    account_name: str
    account_number: str | None = None
    is_retirement: bool = False

class AccountUpdate(BaseModel):
    broker: str | None = None
    account_name: str | None = None
    account_number: str | None = None
    is_retirement: bool | None = None

class AccountOut(BaseModel):
    id: int
    broker: str
    account_name: str
    account_number: str | None = None
    is_retirement: bool
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


# --- ASSET SCHEMAS ---

class AssetCreate(BaseModel):
    name: str
    category: str
    value: float
    annual_increase_percent: float = 0.0
    annual_change_type: str = "increase" # New field
    account_id: int | None = None  # Link to master account
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
    annual_change_type: Optional[str] # New field, made optional
    account_id: Optional[int] = None  # Link to master account
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
    loan_start_date: Optional[str] = None # NEW: Changed from datetime to str
    monthly_payment: Optional[float] = None # NEW
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    include_in_cash_flow: bool = True # New field to control if liability is included in cash flow
    decrease_by_principal_yearly: bool = False  # NEW: Option to decrease liability by principal amount each year
    create_payment_expense: bool = False  # NEW: Option to create corresponding expense for payment amount
    expense_category: Optional[str] = None  # NEW: Category for the generated expense when create_payment_expense is true

class LiabilityUpdate(LiabilityCreate):
    pass

class LiabilityOut(BaseModel):
    id: int
    name: str
    category: str
    value: float
    annual_increase_percent: float
    annual_change_type: Optional[str] # New field, made optional
    loan_type: str # NEW
    principal_amount: Optional[float] = None # NEW
    interest_rate: Optional[float] = None # NEW
    loan_term_months: Optional[int] = None # NEW
    loan_start_date: Optional[str] = None # NEW: Changed from datetime to str
    monthly_payment: Optional[float] = None # NEW
    start_date: str | None = None  # New field
    end_date: str | None = None    # New field
    include_in_cash_flow: bool | None = None # New field to control if liability is included in cash flow
    decrease_by_principal_yearly: bool = False  # NEW
    create_payment_expense: bool = False  # NEW
    expense_category: Optional[str] = None  # NEW: Category for the generated expense when create_payment_expense is true
    model_config = ConfigDict(from_attributes=True)

# --- AUTO-DISBURSEMENT SCHEMAS ---

class AutoDisbursementCreate(BaseModel):
    name: str
    source_asset_id: int
    target_asset_id: int
    transfer_type: str  # "percentage" or "dollar_amount"
    transfer_value: float  # Percentage (0-100) or dollar amount
    start_date: str | None = None  # Start date as string (YYYY-MM-DD)
    end_date: str | None = None    # End date as string (YYYY-MM-DD)

class AutoDisbursementUpdate(BaseModel):
    name: Optional[str] = None
    source_asset_id: Optional[int] = None
    target_asset_id: Optional[int] = None
    transfer_type: Optional[str] = None
    transfer_value: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class AutoDisbursementOut(BaseModel):
    id: int
    name: str
    source_asset_id: int
    target_asset_id: int
    transfer_type: str
    transfer_value: float
    start_date: str | None = None
    end_date: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
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
