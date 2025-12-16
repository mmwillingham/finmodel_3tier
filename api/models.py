from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey
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
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user_owner")
    # Relationship to EmailConfirmationToken: one user can have many confirmation tokens
    email_confirmation_tokens = relationship("EmailConfirmationToken", back_populates="user_owner") # NEW RELATIONSHIP

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
    name = Column(String, index=True)
    years = Column(Integer)
    final_value = Column(Float)
    data_json = Column(String)  # yearly results
    accounts_json = Column(String)  # account metadata with types
    total_contributed = Column(Float)
    total_growth = Column(Float)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="projections")


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


class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    default_inflation_percent = Column(Float, default=2.0)
    asset_categories = Column(String, default="Real Estate,Vehicles,Investments,Other")
    liability_categories = Column(String, default="Mortgage,Car Loan,Credit Card,Student Loan,Other")
    income_categories = Column(String, default="Salary,Bonus,Investment Income,Other")
    expense_categories = Column(String, default="Housing,Transportation,Food,Healthcare,Entertainment,Other")
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
    email = Column(String, default="")
    projection_years = Column(Integer, default=30)
    show_chart_totals = Column(Boolean, default=True) # New field
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
    start_date = Column(String, nullable=True)  # Start date as string (YYYY-MM-DD)
    end_date = Column(String, nullable=True)    # End date as string (YYYY-MM-DD)
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
    # data_sources could be a simple string or a more complex JSON structure
    # For now, a string which can be a comma-separated list like "assets,liabilities"
    data_sources = Column(String, nullable=True)
    # series_configurations will store a JSON string with details for each chart series
    # e.g., [{"data_type": "asset", "field": "value", "aggregation": "sum", "label": "Total Assets", "color": "#abc"}]
    series_configurations = Column(String, nullable=False)
    x_axis_label = Column(String, nullable=True)
    y_axis_label = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User")
