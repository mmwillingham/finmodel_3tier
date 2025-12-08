from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
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
    
    # NEW FIELD: Stores the final numerical result (to fix the previous TypeError)
    final_value = Column(Float) 
    
    # CRITICAL: Use your existing column name for the detailed data
    data_json = Column(String) 
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projections")

# NOTE: The temporary __main__ block to create tables has been removed, 
# as it should have been executed via `python -m financial_projector_api.models` already.
