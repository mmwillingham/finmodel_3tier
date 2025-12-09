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
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
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
    data_json = Column(String) 
    
    # 🌟 CRITICAL FIXES: ADD THESE THREE MISSING COLUMNS
    total_contributed = Column(Float) 
    total_growth = Column(Float)
    accounts = Column(String) # To store the serialized JSON list of input accounts
    
    # Timestamp for when the projection was created
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projections")


class CashFlowItem(Base):
    __tablename__ = "cashflow_items"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_income = Column(Boolean, nullable=False)  # True = income, False = expense
    category = Column(String, nullable=False)    # e.g., Salary, Tax
    description = Column(String, nullable=False)
    frequency = Column(String, nullable=False)   # 'monthly' | 'yearly'
    yearly_value = Column(Float, nullable=False) # stored normalized to yearly
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# NOTE: The temporary __main__ block to create tables has been removed, 
# as it should have been executed via `python -m api.models` already.
