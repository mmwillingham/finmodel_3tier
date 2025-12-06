from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Integer, default=1)
    # Link to the user's projections
    projections = relationship("Projection", back_populates="owner")

class Projection(Base):
    __tablename__ = "projections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    years = Column(Integer)
    # Store all inputs/outputs as a JSON string (similar to your old inputs column)
    data_json = Column(String) 
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Foreign Key to link the projection to the user
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="projections")

# To initialize the tables in the database (run once)
# Base.metadata.create_all(bind=engine)
