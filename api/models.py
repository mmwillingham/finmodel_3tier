from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, JSON, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from datetime import datetime

class User(Base):
    """
    SQLAlchemy Model for the User table.
    """
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True)
    is_confirmed = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=False)
    google_id = Column(String, unique=True, index=True, nullable=True)
    referred_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    subscription_level = Column(Integer, default=1)
    
    # MFA Fields
    mfa_enabled = Column(Boolean, default=False)
    mfa_email_enabled = Column(Boolean, default=False)
    mfa_sms_enabled = Column(Boolean, default=False)
    mfa_phone_number = Column(String, nullable=True)

    # Relationships
    projections = relationship("Projection", back_populates="owner", cascade="all, delete-orphan")
    # THE CLEANER FIX: Explicitly define these so the Asset/Liability models can 'back_populate' them
    assets = relationship("Asset", back_populates="owner", cascade="all, delete-orphan")
    liabilities = relationship("Liability", back_populates="owner", cascade="all, delete-orphan")
    
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user_owner", cascade="all, delete-orphan")
    email_confirmation_tokens = relationship("EmailConfirmationToken", back_populates="user_owner", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="owner", uselist=False, cascade="all, delete-orphan")
    referrals = relationship("Referral", foreign_keys="Referral.referrer_id", back_populates="referrer", cascade="all, delete-orphan")
    referred_by = relationship("User", remote_side=[id], foreign_keys=[referred_by_id])
    what_if_requests = relationship("WhatIfRequestLog", back_populates="user_owner", cascade="all, delete-orphan")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    user_owner = relationship("User", back_populates="password_reset_tokens")

class EmailConfirmationToken(Base):
    __tablename__ = "email_confirmation_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    user_owner = relationship("User", back_populates="email_confirmation_tokens")

class WhatIfRequestLog(Base):
    __tablename__ = "what_if_request_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    user_owner = relationship("User", back_populates="what_if_requests")

class ContactRequestLog(Base):
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
    __tablename__ = "mfa_otp_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    method = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    code_hash = Column(String, nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    user_owner = relationship("User")

class MfaTrustedDevice(Base):
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
    __tablename__ = "projections"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True)
    years = Column(Integer)
    final_value = Column(Float)
    total_contributed = Column(Float)
    total_growth = Column(Float)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    data_json = Column(String, nullable=True)
    last_calculated_at = Column(DateTime(timezone=True), nullable=True)
    owner = relationship("User", back_populates="projections")
    accounts_data = relationship("ProjectedAccount", cascade="all, delete-orphan", back_populates="projection")

class ProjectedAccount(Base):
    __tablename__ = "projected_accounts"
    id = Column(Integer, primary_key=True, index=True)
    projection_id = Column(Integer, ForeignKey("projections.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True)
    account_type = Column(String)
    initial_value = Column(Float)
    contribution = Column(Float)
    growth_rate = Column(Float)
    loan_type = Column(String, nullable=True)
    principal_amount = Column(Float, nullable=True)
    interest_rate = Column(Float, nullable=True)
    loan_term_months = Column(Integer, nullable=True)
    loan_start_date = Column(String, nullable=True)
    monthly_payment = Column(Float, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    cash_flow_item_id = Column(Integer, ForeignKey("cashflow_items.id", ondelete="SET NULL"), nullable=True)
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
    annual_increase_percent = Column(Float, default=0.0)
    inflation_percent = Column(Float, default=0.0)
    person = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    taxable = Column(Boolean, default=False)
    tax_deductible = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    linked_item_id = Column(Integer, nullable=True)
    linked_item_type = Column(String, nullable=True)
    percentage = Column(Float, nullable=True)
    linked_asset_ids = Column(JSON, nullable=True)
    contributes_to_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    contributes_to_asset = relationship("Asset", foreign_keys=[contributes_to_asset_id])
    reinvest_dividends = Column(Boolean, default=False, nullable=True)
    reinvestment_account_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    reinvestment_account = relationship("Asset", foreign_keys=[reinvestment_account_id])
    is_qualified_dividend = Column(Boolean, default=False, nullable=True)
    allow_value_overwrite = Column(Boolean, default=True, nullable=True)

class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    default_inflation_percent = Column(Float, default=2.0)
    asset_categories = Column(JSON, default=["Other", "Checking", "Savings", "Investment"])
    liability_categories = Column(JSON, default=["Other", "Mortgage", "Student Loan", "Car Loan"])
    income_categories = Column(JSON, default=["Salary", "Rental Income", "Investments"])
    expense_categories = Column(JSON, default=["Housing", "Food", "Transportation", "Utilities", "Insurance", "Healthcare", "Entertainment"])
    person1_first_name = Column(String, default="Person 1")
    person1_last_name = Column(String, default="")
    person1_birthdate = Column(String, default="")
    person1_cell_phone = Column(String, default="")
    person2_first_name = Column(String, default="Person 2")
    person2_last_name = Column(String, default="")
    person2_birthdate = Column(String, default="")
    person2_cell_phone = Column(String, default="")
    person1_ss_pia = Column(Float, nullable=True)
    person1_ss_retirement_date = Column(String, nullable=True)
    person1_ss_cola = Column(Float, nullable=True)
    person1_ss_monthly_benefit = Column(Float, nullable=True)
    person2_ss_pia = Column(Float, nullable=True)
    person2_ss_retirement_date = Column(String, nullable=True)
    person2_ss_cola = Column(Float, nullable=True)
    person2_ss_monthly_benefit = Column(Float, nullable=True)
    address = Column(String, default="")
    city = Column(String, default="")
    state = Column(String, default="")
    zip_code = Column(String, default="")
    projection_years = Column(Integer, default=15)
    show_chart_totals = Column(Boolean, default=True)
    surplus_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    tax_filing_status = Column(String, default="Single")
    tax_year = Column(Integer, default=2025)
    calculate_federal_tax = Column(Boolean, default=False)
    calculate_state_tax = Column(Boolean, default=False)
    cash_asset_ids = Column(JSON, default=[])
    cash_in_source_ids = Column(JSON, default=[])
    cash_out_source_ids = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    owner = relationship("User", back_populates="settings")

class GlobalSettings(Base):
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
    __tablename__ = "brokerages"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    broker_name = Column(String, nullable=True)
    broker_phone = Column(String, nullable=True)
    broker_email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    accounts = relationship("Account", back_populates="brokerage_rel", cascade="all, delete-orphan")

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    brokerage_id = Column(Integer, ForeignKey("brokerages.id", ondelete="SET NULL"), nullable=True)
    brokerage = Column(String, nullable=True)
    broker_name = Column(String, nullable=True)
    broker_phone = Column(String, nullable=True)
    broker_email = Column(String, nullable=True)
    account_name = Column(String, nullable=False)
    account_number = Column(String, nullable=True)
    is_retirement = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    brokerage_rel = relationship("Brokerage", back_populates="accounts")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)
    annual_change_type = Column(String, default="increase")
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    retirement_interest_rate = Column(Float, nullable=True)
    retirement_dividend_rate = Column(Float, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # This now matches the property we just added to the User class
    owner = relationship("User", back_populates="assets")

class Liability(Base):
    __tablename__ = "liabilities"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)
    annual_change_type = Column(String, default="increase")
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    loan_type = Column(String, nullable=True, default="ordinary")
    principal_amount = Column(Float, nullable=True)
    interest_rate = Column(Float, nullable=True)
    loan_term_months = Column(Integer, nullable=True)
    loan_start_date = Column(String, nullable=True)
    monthly_payment = Column(Float, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    include_in_cash_flow = Column(Boolean, default=True)
    decrease_by_principal_yearly = Column(Boolean, default=False)
    create_payment_expense = Column(Boolean, default=False)
    expense_category = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # This now matches the property we just added to the User class
    owner = relationship("User", back_populates="liabilities")

class CustomChart(Base):
    __tablename__ = "custom_charts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    chart_type = Column(String, nullable=False)
    display_type = Column(String, default="chart", nullable=False)
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
    __tablename__ = "auto_disbursements"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    source_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    target_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    transfer_type = Column(String, nullable=False)
    transfer_value = Column(Float, nullable=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Referral(Base):
    __tablename__ = "referrals"
    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_name = Column(String, nullable=False)
    friend_email = Column(String, nullable=False, index=True)
    registered_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    registered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referrals")
    registered_user = relationship("User", foreign_keys=[registered_user_id])

class DocumentFolder(Base):
    __tablename__ = "document_folders"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    parent_folder_id = Column(Integer, ForeignKey("document_folders.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    owner = relationship("User")
    parent_folder = relationship("DocumentFolder", remote_side=[id], backref="subfolders")
    documents = relationship("Document", back_populates="folder", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(Integer, ForeignKey("document_folders.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    gcs_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    owner = relationship("User")
    folder = relationship("DocumentFolder", back_populates="documents")

class AuthorizedUser(Base):
    __tablename__ = "authorized_users"
    id = Column(Integer, primary_key=True, index=True)
    primary_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    authorized_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    authorized_user_email = Column(String, nullable=False, index=True)
    financial_data_permission = Column(String, nullable=True)
    document_vault_permission = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    primary_user = relationship("User", foreign_keys=[primary_user_id], backref="authorized_users_granted")
    authorized_user = relationship("User", foreign_keys=[authorized_user_id], backref="authorized_access_received")
    __table_args__ = (UniqueConstraint('primary_user_id', 'authorized_user_id', name='uq_primary_authorized_user'),)

class PlaidItem(Base):
    __tablename__ = "plaid_items"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String, unique=True, nullable=False, index=True)
    access_token = Column(String, nullable=False)
    institution_id = Column(String, nullable=True)
    institution_name = Column(String, nullable=True)
    webhook = Column(String, nullable=True)
    error = Column(JSON, nullable=True)
    available_products = Column(JSON, nullable=True)
    billed_products = Column(JSON, nullable=True)
    consent_expiration_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_successful_update = Column(DateTime(timezone=True), nullable=True)
    owner = relationship("User", backref="plaid_items")