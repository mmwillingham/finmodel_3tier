from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, JSON
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
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True)
    is_confirmed = Column(Boolean, default=False) # NEW FIELD
    is_admin = Column(Boolean, default=False) # NEW FIELD
    google_id = Column(String, unique=True, index=True, nullable=True) # NEW FIELD for Google OAuth
    # Relationship to Projections: one user can have many projections
    projections = relationship("Projection", back_populates="owner")
    # Relationship to PasswordResetToken: one user can have many reset tokens (though we'll only allow one active)
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user_owner", cascade="all, delete-orphan")
    # Relationship to EmailConfirmationToken: one user can have many confirmation tokens
    email_confirmation_tokens = relationship("EmailConfirmationToken", back_populates="user_owner", cascade="all, delete-orphan") # NEW RELATIONSHIP
    # Relationship to UserSettings: one user has one settings record
    settings = relationship("UserSettings", back_populates="owner", uselist=False) # NEW RELATIONSHIP

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

    owner = relationship("User", back_populates="projections")
    accounts_data = relationship("ProjectedAccount", cascade="all, delete-orphan", back_populates="projection")
    time_series_data = relationship("ProjectionTimeSeriesData", cascade="all, delete-orphan", back_populates="projection")


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
    
    # Relationship back to the Projection
    projection = relationship("Projection", back_populates="accounts_data")


class ProjectionTimeSeriesData(Base):
    __tablename__ = "projection_time_series_data"

    id = Column(Integer, primary_key=True, index=True)
    projection_id = Column(Integer, ForeignKey("projections.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("projected_accounts.id", ondelete="CASCADE"), nullable=True) # Optional: link to a specific account
    
    year = Column(Integer, index=True)
    value_type = Column(String, index=True)
    value = Column(Float)

    # Relationships
    projection = relationship("Projection", back_populates="time_series_data")
    account = relationship("ProjectedAccount")


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
    contributes_to_asset_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True) # NEW: For expense items that contribute to an asset
    contributes_to_asset = relationship("Asset", foreign_keys=[contributes_to_asset_id]) # NEW: Relationship to Asset


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
    address = Column(String, default="")
    city = Column(String, default="")
    state = Column(String, default="")
    zip_code = Column(String, default="")
    projection_years = Column(Integer, default=30)
    show_chart_totals = Column(Boolean, default=True) # New field
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
    help_content = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)
    annual_change_type = Column(String, default="increase") # New field
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)    # End date as string (YYYY-MM-DD)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Liability(Base):
    __tablename__ = "liabilities"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    annual_increase_percent = Column(Float, default=0.0)
    annual_change_type = Column(String, default="increase") # New field
    loan_type = Column(String, nullable=True, default="ordinary") # NEW
    principal_amount = Column(Float, nullable=True) # NEW
    interest_rate = Column(Float, nullable=True) # NEW
    loan_term_months = Column(Integer, nullable=True) # NEW
    loan_start_date = Column(String, nullable=True) # NEW: Changed from DateTime to String
    monthly_payment = Column(Float, nullable=True) # NEW
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)    # End date as string (YYYY-MM-DD)
    include_in_cash_flow = Column(Boolean, default=True) # New field to control if liability is included in cash flow
    created_at = Column(DateTime(timezone=True), server_default=func.now())


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