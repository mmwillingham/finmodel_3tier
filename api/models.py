from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, JSON, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from datetime import datetime

class User(Base):
    """
    SQLAlchemy Model for the User table.
    email can be None for users without email addresses (e.g., retirees).
    In that case, the email field serves as a username for login.
    """
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)  # Can be None for users without email
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True)
    is_confirmed = Column(Boolean, default=False) # NEW FIELD
    is_admin = Column(Boolean, default=False) # NEW FIELD
    must_change_password = Column(Boolean, default=False)  # Require password change on first login
    google_id = Column(String, unique=True, index=True, nullable=True) # NEW FIELD for Google OAuth
    referred_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True) # NEW: Track who referred this user
    subscription_level = Column(Integer, default=1)  # 1=Free, 2=Premium, 3=Pro
    mfa_enabled = Column(Boolean, default=False)
    mfa_email_enabled = Column(Boolean, default=False)
    mfa_sms_enabled = Column(Boolean, default=False)
    mfa_phone_number = Column(String, nullable=True)
    # Relationship to Projections: one user can have many projections
    projections = relationship("Projection", back_populates="owner", cascade="all, delete-orphan")
    # Relationship to PasswordResetToken: one user can have many reset tokens (though we'll only allow one active)
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user_owner", cascade="all, delete-orphan")
    # Relationship to EmailConfirmationToken: one user can have many confirmation tokens
    email_confirmation_tokens = relationship("EmailConfirmationToken", back_populates="user_owner", cascade="all, delete-orphan") # NEW RELATIONSHIP
    # Relationship to UserSettings: one user has one settings record
    settings = relationship("UserSettings", back_populates="owner", uselist=False, cascade="all, delete-orphan") # NEW RELATIONSHIP
    # Referral relationships
    referrals = relationship("Referral", foreign_keys="Referral.referrer_id", back_populates="referrer", cascade="all, delete-orphan")
    referred_by = relationship("User", remote_side=[id], foreign_keys=[referred_by_id])
    what_if_requests = relationship("WhatIfRequestLog", back_populates="user_owner", cascade="all, delete-orphan")

class PasswordResetToken(Base):
    """
    SQLAlchemy Model for Password Reset Tokens.
    """
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_owner = relationship("User", back_populates="password_reset_tokens")


class EmailConfirmationToken(Base):
    """
    SQLAlchemy Model for Email Confirmation Tokens.
    """
    __tablename__ = "email_confirmation_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_owner = relationship("User", back_populates="email_confirmation_tokens")


class WhatIfRequestLog(Base):
    """
    SQLAlchemy Model for tracking What If request usage.
    """
    __tablename__ = "what_if_request_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_owner = relationship("User", back_populates="what_if_requests")


class ContactRequestLog(Base):
    """
    SQLAlchemy Model for contact form submissions.
    """
    __tablename__ = "contact_request_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    contact_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_owner = relationship("User")


class MfaOtpLog(Base):
    """
    SQLAlchemy Model for MFA OTP requests.
    """
    __tablename__ = "mfa_otp_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    method = Column(String, nullable=False)  # email or sms
    destination = Column(String, nullable=False)  # email or phone number
    code_hash = Column(String, nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_owner = relationship("User")


class MfaTrustedDevice(Base):
    """
    SQLAlchemy Model for trusted MFA devices.
    """
    __tablename__ = "mfa_trusted_devices"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_owner = relationship("User")


class Projection(Base):
    """
    SQLAlchemy Model for the Projection table.
    """
    __tablename__ = "projections"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True)
    years = Column(Integer) # Number of years for the projection
    final_value = Column(Float)
    total_contributed = Column(Float)
    total_growth = Column(Float)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    data_json = Column(String, nullable=True)  # Pre-calculated projection data as JSON string for fast retrieval
    last_calculated_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when projection was last calculated

    owner = relationship("User", back_populates="projections")
    accounts_data = relationship("ProjectedAccount", cascade="all, delete-orphan", back_populates="projection")


class ProjectedAccount(Base):
    __tablename__ = "projected_accounts"

    id = Column(Integer, primary_key=True, index=True)
    projection_id = Column(Integer, ForeignKey("projections.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String, index=True)
    account_type = Column(String) # e.g., "asset", "liability", "income", "expense"
    initial_value = Column(Float)
    contribution = Column(Float)
    growth_rate = Column(Float)
    # NEW fields for amortized loans
    loan_type = Column(String, nullable=True)  # "ordinary" or "amortized"
    principal_amount = Column(Float, nullable=True)
    interest_rate = Column(Float, nullable=True) # Annual interest rate as percentage
    loan_term_months = Column(Integer, nullable=True)
    loan_start_date = Column(String, nullable=True) # YYYY-MM-DD format
    monthly_payment = Column(Float, nullable=True) # Calculated monthly payment
    # Fields for cash flow items (income/expense)
    start_date = Column(String, nullable=True)  # YYYY-MM-DD format for income/expense start date
    end_date = Column(String, nullable=True)  # YYYY-MM-DD format for income/expense end date
    # NEW: ID reference to CashFlowItem for reliable lookups (instead of description-based matching)
    cash_flow_item_id = Column(Integer, ForeignKey("cashflow_items.id", ondelete="SET NULL"), nullable=True)  # ID of the CashFlowItem this account represents (for income/expense types)
    
    # Relationship back to the Projection
    projection = relationship("Projection", back_populates="accounts_data")


class CashFlowItem(Base):
    __tablename__ = "cashflow_items"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_income = Column(Boolean, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    frequency = Column(String, nullable=False)
    yearly_value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)  # For income
    inflation_percent = Column(Float, default=0.0)  # For expenses
    person = Column(String, nullable=True)  # Optional person name
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)  # End date as string (YYYY-MM-DD)
    taxable = Column(Boolean, default=False)  # For income
    tax_deductible = Column(Boolean, default=False)  # For expenses
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # New fields for dynamic items
    linked_item_id = Column(Integer, nullable=True)
    linked_item_type = Column(String, nullable=True)  # 'asset', 'income', 'expense'
    percentage = Column(Float, nullable=True)
    linked_asset_ids = Column(JSON, nullable=True)  # NEW: Array of asset IDs for multi-select (for income items)
    contributes_to_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True) # NEW: For expense items that contribute to an asset
    contributes_to_asset = relationship("Asset", foreign_keys=[contributes_to_asset_id]) # NEW: Relationship to Asset
    # NEW: Dividend reinvestment fields
    reinvest_dividends = Column(Boolean, default=False, nullable=True)  # Whether dividends should be reinvested
    reinvestment_account_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)  # Account to reinvest into (optional, defaults to source asset)
    reinvestment_account = relationship("Asset", foreign_keys=[reinvestment_account_id])  # Relationship to Asset for reinvestment
    # NEW: Qualified dividend field
    is_qualified_dividend = Column(Boolean, default=False, nullable=True)  # Whether dividends are qualified (defaults to False)
    # NEW: Allow value overwrite field (for auto-generated items like Social Security)
    allow_value_overwrite = Column(Boolean, default=True, nullable=True)  # Whether system can overwrite yearly_value (defaults to True)


class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False) # Changed to owner_id
    default_inflation_percent = Column(Float, default=2.0)
    asset_categories = Column(JSON, default=["Other", "Checking", "Savings", "Investment"])
    liability_categories = Column(JSON, default=["Other", "Mortgage", "Student Loan", "Car Loan"])
    income_categories = Column(JSON, default=["Salary", "Rental Income", "Investments"])
    expense_categories = Column(JSON, default=["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"])
    person1_first_name = Column(String, default="Person 1")
    person1_last_name = Column(String, default="")
    person1_birthdate = Column(String, default="") # New field for person 1's birthdate
    person1_cell_phone = Column(String, default="") # New field for person 1's cell phone
    person2_first_name = Column(String, default="Person 2")
    person2_last_name = Column(String, default="")
    person2_birthdate = Column(String, default="") # New field for person 2's birthdate
    person2_cell_phone = Column(String, default="") # New field for person 2's cell phone
    # Social Security fields for Person 1
    person1_ss_pia = Column(Float, nullable=True)  # Social Security Full Retirement Monthly Benefit (PIA)
    person1_ss_retirement_date = Column(String, nullable=True)  # Social Security Retirement Date (YYYY-MM-DD)
    person1_ss_cola = Column(Float, nullable=True)  # Social Security COLA (avg) - used as Annual Increase Percentage
    person1_ss_monthly_benefit = Column(Float, nullable=True)  # Calculated Social Security Monthly Benefit
    # Social Security fields for Person 2
    person2_ss_pia = Column(Float, nullable=True)  # Social Security Full Retirement Monthly Benefit (PIA)
    person2_ss_retirement_date = Column(String, nullable=True)  # Social Security Retirement Date (YYYY-MM-DD)
    person2_ss_cola = Column(Float, nullable=True)  # Social Security COLA (avg) - used as Annual Increase Percentage
    person2_ss_monthly_benefit = Column(Float, nullable=True)  # Calculated Social Security Monthly Benefit
    address = Column(String, default="")
    city = Column(String, default="")
    state = Column(String, default="")
    zip_code = Column(String, default="")
    projection_years = Column(Integer, default=15)
    show_chart_totals = Column(Boolean, default=True) # New field
    surplus_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)  # Designated asset for surplus/deficit
    tax_filing_status = Column(String, default="Single")  # Tax filing status: Single, Married Filing Jointly, etc.
    tax_year = Column(Integer, default=2025)  # Tax year for calculations (allows updating brackets when year changes)
    calculate_federal_tax = Column(Boolean, default=False)  # Whether to calculate and create federal income tax expense item
    calculate_state_tax = Column(Boolean, default=False)  # Whether to calculate and create state income tax expense item
    cash_asset_ids = Column(JSON, default=[])  # Array of asset IDs that are considered cash for BASE model and Sankey diagram
    cash_in_source_ids = Column(JSON, default=[])  # Array of income item IDs for cash-in sources (empty = all income)
    cash_out_source_ids = Column(JSON, default=[])  # Array of expense item IDs for cash-out sources (empty = all expenses)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="settings")


class GlobalSettings(Base):
    """
    SQLAlchemy Model for Global Default Categories. There should only be one record in this table.
    """
    __tablename__ = "global_settings"
    id = Column(Integer, primary_key=True, index=True)
    asset_categories = Column(JSON, default=["Other", "Checking", "Savings", "Investment"])
    liability_categories = Column(JSON, default=["Other", "Mortgage", "Student Loan", "Car Loan"])
    income_categories = Column(JSON, default=["Salary", "Rental Income", "Investments"])
    expense_categories = Column(JSON, default=["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"])
    free_max_projection_years = Column(Integer, default=5)
    free_max_documents = Column(Integer, default=5)
    free_max_whatif_monthly = Column(Integer, default=5)
    help_content = Column(String, nullable=True)
    about_content = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Brokerage(Base):
    """
    SQLAlchemy Model for Brokerages (Financial Institutions).
    Groups accounts under a single brokerage with shared broker information.
    """
    __tablename__ = "brokerages"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)  # Brokerage name, e.g., "Merrill Lynch", "Fidelity"
    broker_name = Column(String, nullable=True)  # Name of the broker/advisor
    broker_phone = Column(String, nullable=True)  # Phone number of the broker/advisor
    broker_email = Column(String, nullable=True)  # Email of the broker/advisor
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to accounts
    accounts = relationship("Account", back_populates="brokerage_rel", cascade="all, delete-orphan")


class Account(Base):
    """
    SQLAlchemy Model for Master Accounts (Broker/Financial Institution Accounts).
    These are container accounts that can hold multiple assets.
    """
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    brokerage_id = Column(Integer, ForeignKey("brokerages.id", ondelete="SET NULL"), nullable=True)  # NEW: Link to brokerage
    # Legacy fields - kept for backward compatibility during migration
    brokerage = Column(String, nullable=True)  # Will be deprecated after migration
    broker_name = Column(String, nullable=True)  # Will be deprecated after migration
    broker_phone = Column(String, nullable=True)  # Will be deprecated after migration
    broker_email = Column(String, nullable=True)  # Will be deprecated after migration
    account_name = Column(String, nullable=False)  # e.g., "Investment Account", "Checking Account"
    account_number = Column(String, nullable=True)  # Account number (optional)
    is_retirement = Column(Boolean, default=False)  # True for retirement accounts (IRA, 401k, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to brokerage
    brokerage_rel = relationship("Brokerage", back_populates="accounts")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)
    annual_change_type = Column(String, default="increase") # New field
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)  # Link to master account
    retirement_interest_rate = Column(Float, nullable=True)  # Interest rate for retirement accounts (reinvested, not taxable)
    retirement_dividend_rate = Column(Float, nullable=True)  # Dividend rate for retirement accounts (reinvested, not taxable)
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)    # End date as string (YYYY-MM-DD)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Liability(Base):
    __tablename__ = "liabilities"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)
    annual_change_type = Column(String, default="increase") # New field
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)  # Link to master account
    loan_type = Column(String, nullable=True, default="ordinary") # NEW
    principal_amount = Column(Float, nullable=True) # NEW
    interest_rate = Column(Float, nullable=True) # NEW
    loan_term_months = Column(Integer, nullable=True) # NEW
    loan_start_date = Column(String, nullable=True) # NEW: Changed from DateTime to String
    monthly_payment = Column(Float, nullable=True) # NEW
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)    # End date as string (YYYY-MM-DD)
    include_in_cash_flow = Column(Boolean, default=True) # New field to control if liability is included in cash flow
    decrease_by_principal_yearly = Column(Boolean, default=False)  # NEW: Option to decrease liability by principal amount each year
    create_payment_expense = Column(Boolean, default=False)  # NEW: Option to create corresponding expense for payment amount
    expense_category = Column(String, nullable=True)  # NEW: Category for the generated expense when create_payment_expense is true
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CustomChart(Base):
    """
    SQLAlchemy Model for Custom Charts.
    """
    __tablename__ = "custom_charts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    chart_type = Column(String, nullable=False)  # e.g., 'line', 'bar', 'pie'
    display_type = Column(String, default="chart", nullable=False) # New field for chart/table display
    data_sources = Column(String, nullable=True)
    series_configurations = Column(String, nullable=False)
    x_axis_label = Column(String, nullable=True)
    y_axis_label = Column(String, nullable=True)
    
    data_json = Column(String, nullable=True)
    final_value = Column(Float, nullable=True)
    total_contributed = Column(Float, nullable=True)
    total_growth = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User")


class AutoDisbursement(Base):
    """
    SQLAlchemy Model for Auto-Disbursement Rules.
    Defines yearly transfers between accounts (percentage or dollar amount).
    """
    __tablename__ = "auto_disbursements"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)  # Description of the transfer
    source_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)  # Source asset account
    target_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)  # Target asset account
    transfer_type = Column(String, nullable=False)  # "percentage" or "dollar_amount"
    transfer_value = Column(Float, nullable=False)  # Percentage (0-100) or dollar amount
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)  # End date as string (YYYY-MM-DD)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Referral(Base):
    """
    SQLAlchemy Model for tracking user referrals.
    """
    __tablename__ = "referrals"
    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # User who made the referral
    friend_name = Column(String, nullable=False)  # Name of the referred friend
    friend_email = Column(String, nullable=False, index=True)  # Email of the referred friend
    registered_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # User ID if they registered
    registered_at = Column(DateTime(timezone=True), nullable=True)  # When the friend registered
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # When the referral was created
    
    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referrals")
    registered_user = relationship("User", foreign_keys=[registered_user_id])


class DocumentFolder(Base):
    """
    SQLAlchemy Model for document folders.
    Users can organize their documents into folders.
    """
    __tablename__ = "document_folders"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    parent_folder_id = Column(Integer, ForeignKey("document_folders.id", ondelete="CASCADE"), nullable=True)  # For nested folders
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User")
    parent_folder = relationship("DocumentFolder", remote_side=[id], backref="subfolders")
    documents = relationship("Document", back_populates="folder", cascade="all, delete-orphan")


class Document(Base):
    """
    SQLAlchemy Model for documents.
    Documents are stored in Google Cloud Storage, with metadata in the database.
    """
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(Integer, ForeignKey("document_folders.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, nullable=False)  # Original filename
    description = Column(String, nullable=True)
    file_type = Column(String, nullable=True)  # MIME type
    file_size = Column(Integer, nullable=True)  # Size in bytes
    gcs_path = Column(String, nullable=False)  # Path in Google Cloud Storage bucket
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User")
    folder = relationship("DocumentFolder", back_populates="documents")


class AuthorizedUser(Base):
    """
    SQLAlchemy Model for authorized users.
    Allows a primary user to grant access to another user with granular permissions.
    authorized_user_id can be None if the user hasn't registered yet - they'll be linked when they sign up.
    """
    __tablename__ = "authorized_users"
    id = Column(Integer, primary_key=True, index=True)
    primary_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # Owner who grants access
    authorized_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # User who receives access (None until they register)
    authorized_user_email = Column(String, nullable=False, index=True)  # Email of authorized user (for reference)
    
    # Simplified permissions: "view", "edit", or None (no access)
    financial_data_permission = Column(String, nullable=True)  # "view" or "edit" (applies to accounts, items, projections, charts)
    document_vault_permission = Column(String, nullable=True)  # "view" or "edit" (renamed from documents)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    primary_user = relationship("User", foreign_keys=[primary_user_id], backref="authorized_users_granted")
    authorized_user = relationship("User", foreign_keys=[authorized_user_id], backref="authorized_access_received")
    
    # Ensure unique combination of primary_user_id and authorized_user_id
    __table_args__ = (
        UniqueConstraint('primary_user_id', 'authorized_user_id', name='uq_primary_authorized_user'),
    )


class PlaidItem(Base):
    """
    SQLAlchemy Model for Plaid Items (connected bank accounts).
    Stores Plaid access tokens and metadata for syncing account data.
    """
    __tablename__ = "plaid_items"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String, unique=True, nullable=False, index=True)  # Plaid item_id
    access_token = Column(String, nullable=False)  # Encrypted Plaid access token
    institution_id = Column(String, nullable=True)  # Plaid institution ID
    institution_name = Column(String, nullable=True)  # Institution name for display
    webhook = Column(String, nullable=True)  # Webhook URL (if configured)
    error = Column(JSON, nullable=True)  # Store any Plaid errors
    available_products = Column(JSON, nullable=True)  # Available Plaid products
    billed_products = Column(JSON, nullable=True)  # Billed Plaid products
    consent_expiration_time = Column(DateTime(timezone=True), nullable=True)  # When consent expires
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_successful_update = Column(DateTime(timezone=True), nullable=True)  # Last successful sync
    
    # Relationship to user
    owner = relationship("User", backref="plaid_items")