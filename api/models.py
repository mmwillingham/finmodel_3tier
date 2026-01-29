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
    user_settings = relationship("UserSettings", back_populates="owner", uselist=False, cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="owner", cascade="all, delete-orphan")
    liabilities = relationship("Liability", back_populates="owner", cascade="all, delete-orphan")
    cashflow_items = relationship("CashFlowItem", back_populates="owner", cascade="all, delete-orphan")

class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    
    # Categories synced from GlobalSettings
    asset_categories = Column(JSON, default=list)
    liability_categories = Column(JSON, default=list)
    income_categories = Column(JSON, default=list)
    expense_categories = Column(JSON, default=list)
    
    owner = relationship("User", back_populates="user_settings")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    category = Column(String)
    value = Column(Float, default=0.0)
    growth_rate = Column(Float, default=0.0)
    
    owner = relationship("User", back_populates="assets")

class Liability(Base):
    __tablename__ = "liabilities"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    category = Column(String)
    balance = Column(Float, default=0.0)
    interest_rate = Column(Float, default=0.0)
    monthly_payment = Column(Float, default=0.0)
    
    owner = relationship("User", back_populates="liabilities")

class CashFlowItem(Base):
    __tablename__ = "cashflow_items"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    type = Column(String) # Income or Expense
    value = Column(Float, default=0.0)
    frequency = Column(String, default="monthly")
    yearly_value = Column(Float, default=0.0)
    start_date = Column(String, nullable=True)
    
    owner = relationship("User", back_populates="cashflow_items")

class Projection(Base):
    __tablename__ = "projections"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String)
    years = Column(Integer)
    final_value = Column(Float)
    total_contributed = Column(Float)
    total_growth = Column(Float)
    data_json = Column(Text)
    
    accounts_data = relationship("ProjectedAccount", back_populates="projection", cascade="all, delete-orphan")

class ProjectedAccount(Base):
    __tablename__ = "projected_accounts"
    id = Column(Integer, primary_key=True, index=True)
    projection_id = Column(Integer, ForeignKey("projections.id", ondelete="CASCADE"))
    name = Column(String)
    account_type = Column(String)
    initial_value = Column(Float)
    contribution = Column(Float)
    growth_rate = Column(Float)
    cash_flow_item_id = Column(Integer, nullable=True)
    
    projection = relationship("Projection", back_populates="accounts_data")

class MfaOtpLog(Base):
    """Stores the 6-digit verification codes for MFA."""
    __tablename__ = "mfa_otp_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    method = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    code_hash = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String, nullable=True)

class MfaTrustedDevice(Base):
    """Stores tokens for 'Remember this device' functionality."""
    __tablename__ = "mfa_trusted_devices"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_token_hash = Column(String, nullable=False, index=True)
    last_used_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GlobalSettings(Base):
    """System-wide default categories for new users."""
    __tablename__ = "global_settings"
    id = Column(Integer, primary_key=True)
    asset_categories = Column(JSON, default=list)
    liability_categories = Column(JSON, default=list)
    income_categories = Column(JSON, default=list)
    expense_categories = Column(JSON, default=list)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class EmailConfirmationToken(Base):
    __tablename__ = "email_confirmation_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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