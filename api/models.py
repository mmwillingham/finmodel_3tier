from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
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
    # Relationship to Projections: one user can have many projections
    projections = relationship("Projection", back_populates="owner")


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    default_inflation_percent = Column(Float, default=2.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
