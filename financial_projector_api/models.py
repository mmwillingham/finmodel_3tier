from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
# Import Base from the database module
from .database import Base


class User(Base):
    """
    SQLAlchemy Model for the User table.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # Relationship to Projections: one user can have many projections
    projections = relationship("Projection", back_populates="owner")


class Projection(Base):
    """
    SQLAlchemy Model for the Projection table.
    Stores the calculation inputs and the resulting JSON data.
    """
    __tablename__ = "projections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    years = Column(Integer)
    data_json = Column(String)

    # CRUCIAL: Define the Foreign Key to link to the User table
    # This column holds the ID of the user who owns the projection
    owner_id = Column(Integer, ForeignKey("users.id")) 

    # Relationship to User: one projection belongs to one owner
    owner = relationship("User", back_populates="projections")

# NOTE: The temporary __main__ block to create tables has been removed, 
# as it should have been executed via `python -m financial_projector_api.models` already.
