from __future__ import annotations

from copy import deepcopy
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re
from typing import List, Optional, Any
from datetime import datetime, date
from utils.document_folder_defaults import DEFAULT_DOCUMENT_FOLDER_STRUCTURE

# --- USER SCHEMAS ---

class UserBase(BaseModel):
    email: Optional[str] = None  # Can be None for users without email (e.g., retirees)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    referred_by_email: Optional[str] = None  # Optional: Email of the user who referred them

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
    email: Optional[str] = None
    created_at: datetime
    is_confirmed: bool = False # NEW FIELD
    is_admin: bool = False # NEW FIELD
    must_change_password: bool = False  # Require password change on first login
    subscription_level: int = 1
    mfa_enabled: bool = False
    mfa_email_enabled: bool = False
    mfa_phone_number: str | None = None
    mfa_passkey_enabled: bool = False
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


class ContactRequest(BaseModel):
    contact_type: str
    name: str
    email: str
    subject: Optional[str] = None
    message: str

class UserAdminStatusUpdate(BaseModel):
    is_admin: bool
    subscription_level: Optional[int] = None

class AdminUserCreate(BaseModel):
    """Schema for admin to create users (email optional, can set must_change_password)"""
    email: Optional[str] = None  # Username/email - can be None
    password: str = Field(..., min_length=8)
    must_change_password: bool = True  # Default to True for admin-created users
    subscription_level: int = 1
    
    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v

class CheckoutSessionRequest(BaseModel):
    tier: str = Field(..., description="Tier to purchase (premium/pro)")

class CheckoutSessionResponse(BaseModel):
    sessionId: str
    url: str

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
    # Fields for cash flow items (income/expense)
    start_date: Optional[str] = None  # YYYY-MM-DD format for income/expense start date
    end_date: Optional[str] = None  # YYYY-MM-DD format for income/expense end date
    # NEW: ID reference to CashFlowItem for reliable lookups (instead of description-based matching)
    cash_flow_item_id: Optional[int] = None  # ID of the CashFlowItem this account represents (for income/expense types)


class ProjectedAccountCreate(ProjectedAccountBase):
    pass

class ProjectedAccountOut(ProjectedAccountBase):
    id: int
    projection_id: int
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
    time_series_data: List[dict] = []  # Deprecated - use data_json instead. Kept for backward compatibility.
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
    owner_id: int  # Added to allow frontend to check ownership before update
    model_config = ConfigDict(from_attributes=True)

class ProjectionDetailOut(BaseModel):
    id: int
    name: str
    years: int
    final_value: float | None = None
    total_contributed: float | None = None
    total_growth: float | None = None
    accounts_data: List[ProjectedAccountOut] = [] # NEW
    time_series_data: List[dict] = []  # Deprecated - use data_json instead. Kept for backward compatibility.
    data_json: Optional[str] = None  # NEW: Include data_json
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
    start_date: str | None = Field(default=None, description="Start date (YYYY-MM-DD). Defaults to January 1 of current year if not provided.")  # Optional; defaulted server-side
    end_date: str | None = None
    taxable: bool = False
    tax_deductible: bool = False
    linked_item_id: Optional[int] = None
    linked_item_type: Optional[str] = None
    percentage: Optional[float] = None
    linked_asset_ids: Optional[List[int]] = None  # NEW: Array of asset IDs for multi-select (for income items)
    contributes_to_asset_id: Optional[int] = None # NEW: For expense items that contribute to an asset
    reinvest_dividends: Optional[bool] = False  # NEW: Whether to reinvest dividends (for income items)
    reinvestment_account_id: Optional[int] = None  # NEW: Account ID to reinvest into (optional, defaults to source asset)
    is_qualified_dividend: Optional[bool] = False  # NEW: Whether dividends are qualified (defaults to False)
    allow_value_overwrite: Optional[bool] = True  # NEW: Whether system can overwrite yearly_value (defaults to True)

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
    linked_asset_ids: Optional[List[int]] = None  # NEW: Array of asset IDs for multi-select (for income items)
    contributes_to_asset_id: Optional[int] = None # NEW: For expense items that contribute to an asset
    reinvest_dividends: Optional[bool] = None  # NEW: Whether to reinvest dividends (for income items)
    reinvestment_account_id: Optional[int] = None  # NEW: Account ID to reinvest into (optional, defaults to source asset)
    is_qualified_dividend: Optional[bool] = None  # NEW: Whether dividends are qualified
    allow_value_overwrite: Optional[bool] = None  # NEW: Whether system can overwrite yearly_value

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
    linked_asset_ids: Optional[List[int]] = None  # NEW: Array of asset IDs for multi-select (for income items)
    contributes_to_asset_id: Optional[int] = None # NEW: For expense items that contribute to an asset
    reinvest_dividends: Optional[bool] = None  # NEW: Whether to reinvest dividends (for income items)
    reinvestment_account_id: Optional[int] = None  # NEW: Account ID to reinvest into (optional, defaults to source asset)
    is_qualified_dividend: Optional[bool] = None  # NEW: Whether dividends are qualified
    allow_value_overwrite: Optional[bool] = None  # NEW: Whether system can overwrite yearly_value
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
    # Social Security fields for Person 1
    person1_ss_pia: Optional[float] = None  # Social Security Full Retirement Monthly Benefit (PIA)
    person1_ss_retirement_date: Optional[str] = None  # Social Security Retirement Date (YYYY-MM-DD)
    person1_ss_cola: Optional[float] = None  # Social Security COLA (avg) - used as Annual Increase Percentage
    person1_ss_monthly_benefit: Optional[float] = None  # Calculated Social Security Monthly Benefit
    # Social Security fields for Person 2
    person2_ss_pia: Optional[float] = None  # Social Security Full Retirement Monthly Benefit (PIA)
    person2_ss_retirement_date: Optional[str] = None  # Social Security Retirement Date (YYYY-MM-DD)
    person2_ss_cola: Optional[float] = None  # Social Security COLA (avg) - used as Annual Increase Percentage
    person2_ss_monthly_benefit: Optional[float] = None  # Calculated Social Security Monthly Benefit
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    projection_years: int = 15
    show_chart_totals: bool = True
    surplus_asset_id: Optional[int] = None  # Designated asset for surplus/deficit
    tax_filing_status: str = "Single"  # Tax filing status: Single, Married Filing Jointly, etc.
    tax_year: int = 2025  # Tax year for calculations (allows updating brackets when year changes)
    calculate_federal_tax: bool = False  # Whether to calculate and create federal income tax expense item
    calculate_state_tax: bool = False  # Whether to calculate and create state income tax expense item
    cash_asset_ids: List[int] = []  # Array of asset IDs that are considered cash for BASE model and Sankey diagram
    cash_in_source_ids: List[int] = []  # Array of income item IDs for cash-in sources (empty = all income)
    cash_out_source_ids: List[int] = []  # Array of expense item IDs for cash-out sources (empty = all expenses)

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
    # Social Security fields for Person 1
    person1_ss_pia: Optional[float] = None
    person1_ss_retirement_date: Optional[str] = None
    person1_ss_cola: Optional[float] = None
    person1_ss_monthly_benefit: Optional[float] = None
    # Social Security fields for Person 2
    person2_ss_pia: Optional[float] = None
    person2_ss_retirement_date: Optional[str] = None
    person2_ss_cola: Optional[float] = None
    person2_ss_monthly_benefit: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    projection_years: Optional[int] = None
    show_chart_totals: Optional[bool] = None
    surplus_asset_id: Optional[int] = None
    tax_filing_status: Optional[str] = None
    tax_year: Optional[int] = None
    calculate_federal_tax: Optional[bool] = None
    calculate_state_tax: Optional[bool] = None
    cash_asset_ids: Optional[List[int]] = None
    cash_in_source_ids: Optional[List[int]] = None
    cash_out_source_ids: Optional[List[int]] = None

class UserSettingsOut(UserSettingsBase):
    id: int
    owner_id: int # Changed from user_id to owner_id
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- GLOBAL SETTINGS SCHEMAS ---

class DocumentFolderStructureItem(BaseModel):
    name: str
    children: Optional[List["DocumentFolderStructureItem"]] = None

    model_config = ConfigDict(extra="forbid")

DocumentFolderStructureItem.model_rebuild()


class GlobalSettingsBase(BaseModel):
    asset_categories: List[str] = ["Other", "Checking", "Savings", "Investment"]
    liability_categories: List[str] = ["Other", "Mortgage", "Student Loan", "Car Loan"]
    income_categories: List[str] = ["Salary", "Rental Income", "Investments"]
    expense_categories: List[str] = ["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"]
    free_max_projection_years: int = 5
    free_max_documents: int = 5
    free_max_whatif_monthly: int = 5
    default_document_folders: List[DocumentFolderStructureItem] = Field(default_factory=lambda: deepcopy(DEFAULT_DOCUMENT_FOLDER_STRUCTURE))

class GlobalSettingsCreate(GlobalSettingsBase):
    pass

class GlobalSettingsUpdate(BaseModel):
    asset_categories: Optional[List[str]] = None
    liability_categories: Optional[List[str]] = None
    income_categories: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    free_max_projection_years: Optional[int] = None
    free_max_documents: Optional[int] = None
    free_max_whatif_monthly: Optional[int] = None
    help_content: Optional[str] = None
    about_content: Optional[str] = None
    default_document_folders: Optional[List[DocumentFolderStructureItem]] = None

class GlobalSettingsOut(GlobalSettingsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    help_content: Optional[str] = None
    about_content: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class SubscriptionLimitsOut(BaseModel):
    subscription_level: int
    is_limited: bool
    max_projection_years: Optional[int] = None
    max_documents: Optional[int] = None
    max_whatif_monthly: Optional[int] = None

class PublicContentResponse(BaseModel):
    """Schema for public content endpoints (help/about) - readable by any authenticated user"""
    help_content: Optional[str] = None
    about_content: Optional[str] = None

class StateTaxResult(BaseModel):
    state_taxable_income: float
    state_standard_deduction: float
    state_tax: float
    model_config = ConfigDict(from_attributes=True)


# --- BROKERAGE SCHEMAS ---

class BrokerageBase(BaseModel):
    name: str
    broker_name: str | None = None
    broker_phone: str | None = None
    broker_email: str | None = None

class BrokerageCreate(BrokerageBase):
    pass

class BrokerageUpdate(BaseModel):
    name: str | None = None
    broker_name: str | None = None
    broker_phone: str | None = None
    broker_email: str | None = None

class BrokerageOut(BrokerageBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)

# --- PLAID SCHEMAS ---

class PlaidExchangeTokenRequest(BaseModel):
    public_token: str

class PlaidItemOut(BaseModel):
    id: int
    item_id: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None
    error: Optional[Any] = None
    available_products: Optional[List[str]] = None
    billed_products: Optional[List[str]] = None
    consent_expiration_time: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_successful_update: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class PlaidAccountPreview(BaseModel):
    """Preview of an account from Plaid before mapping"""
    account_id: str
    account_name: str
    account_type: str  # 'investment', 'depository', 'credit', etc.
    account_subtype: Optional[str] = None
    balance: float
    mask: Optional[str] = None
    suggested_category: str  # Suggested category based on account type
    suggested_type: str  # 'asset' or 'liability'

class PlaidAccountMapping(BaseModel):
    """User-defined mapping for a Plaid account"""
    account_id: str
    category: str
    type: str  # 'asset' or 'liability'

class PlaidApplyMappingsRequest(BaseModel):
    """Request to apply mappings and create assets/liabilities"""
    mappings: List[PlaidAccountMapping]

# --- ACCOUNT SCHEMAS ---

class AccountCreate(BaseModel):
    brokerage_id: int | None = None  # NEW: Use brokerage_id if creating account under existing brokerage
    # Legacy fields - used if brokerage_id is None (creates brokerage automatically)
    brokerage: str | None = None  # Brokerage name - used to find or create brokerage
    broker_name: str | None = None
    broker_phone: str | None = None
    broker_email: str | None = None
    account_name: str
    account_number: str | None = None
    is_retirement: bool = False

class AccountUpdate(BaseModel):
    brokerage_id: int | None = None  # NEW: Update to use different brokerage
    account_name: str | None = None
    account_number: str | None = None
    is_retirement: bool | None = None

class AccountOut(BaseModel):
    id: int
    brokerage_id: int | None = None  # NEW: Brokerage ID
    brokerage: str  # Brokerage name (from relationship or legacy field)
    broker_name: str | None = None
    broker_phone: str | None = None
    broker_email: str | None = None
    account_name: str
    account_number: str | None = None
    is_retirement: bool
    owner_id: int  # Added to show ownership
    owner_email: str | None = None  # Added to show owner email
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
    retirement_interest_rate: float | None = None  # Interest rate for retirement accounts (reinvested, not taxable)
    retirement_dividend_rate: float | None = None  # Dividend rate for retirement accounts (reinvested, not taxable)
    start_date: str = Field(default_factory=lambda: f"{date.today().year}-01-01", description="Start date (YYYY-MM-DD). Defaults to January 1 of current year if not provided.")  # Required field with default
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
    retirement_interest_rate: Optional[float] = None  # Interest rate for retirement accounts (reinvested, not taxable)
    retirement_dividend_rate: Optional[float] = None  # Dividend rate for retirement accounts (reinvested, not taxable)
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
    start_date: str = Field(default_factory=lambda: f"{date.today().year}-01-01", description="Start date (YYYY-MM-DD). Defaults to January 1 of current year if not provided.")  # Required field with default
    end_date: str | None = None    # New field
    include_in_cash_flow: bool = True # New field to control if liability is included in cash flow
    decrease_by_principal_yearly: bool = False  # NEW: Option to decrease liability by principal amount each year
    create_payment_expense: bool = False  # NEW: Option to create corresponding expense for payment amount
    expense_category: Optional[str] = None  # NEW: Category for the generated expense when create_payment_expense is true

    @field_validator("start_date", "loan_start_date", mode="before")
    @classmethod
    def coerce_dates_to_string(cls, value):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        return value

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
    distribution_type: str | None = None  # "taxable_ira" | "non_taxable" | None
    use_rmd: bool | None = None
    rmd_overrides: dict | None = None  # Mapping year->amount, stored as JSON
    use_rmd: bool | None = None

class AutoDisbursementUpdate(BaseModel):
    name: Optional[str] = None
    source_asset_id: Optional[int] = None
    target_asset_id: Optional[int] = None
    transfer_type: Optional[str] = None
    transfer_value: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    distribution_type: Optional[str] = None
    use_rmd: Optional[bool] = None
    rmd_overrides: Optional[dict] = None
    use_rmd: Optional[bool] = None

class AutoDisbursementOut(BaseModel):
    id: int
    name: str
    source_asset_id: int
    target_asset_id: int
    transfer_type: str
    transfer_value: float
    start_date: str | None = None
    end_date: str | None = None
    distribution_type: str | None = None
    use_rmd: bool | None = None
    rmd_overrides: dict | None = None
    taxable_income_cashflow_item_id: int | None = None
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
    skip_recalculate: Optional[bool] = False  # If True, skip recalculation (only update config)

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


# --- MFA SCHEMAS ---

class MfaSettingsOut(BaseModel):
    mfa_enabled: bool = False
    mfa_email_enabled: bool = False
    mfa_passkey_enabled: bool = False
    mfa_passkey_registered: bool = False
    mfa_passkey_count: int = 0


class MfaSettingsUpdate(BaseModel):
    mfa_enabled: bool | None = None
    mfa_email_enabled: bool | None = None
    mfa_passkey_enabled: bool | None = None


class MfaRequestOtp(BaseModel):
    mfa_token: str
    method: str


class MfaVerifyOtp(BaseModel):
    mfa_token: str
    method: str
    code: str
    remember_device: bool | None = None


class MfaPasskeyRegister(BaseModel):
    credential: dict[str, Any]


class MfaPasskeyAuthOptions(BaseModel):
    mfa_token: str


class MfaPasskeyVerify(BaseModel):
    mfa_token: str
    credential: dict[str, Any]
    remember_device: bool | None = None


class MfaPasskeyCredentialOut(BaseModel):
    id: int
    label: str | None = None
    created_at: datetime
    last_used_at: datetime | None = None
    device_type: str | None = None
    backed_up: bool | None = None
    transports: Any | None = None


class MfaPasskeyCredentialUpdate(BaseModel):
    label: str | None = None
