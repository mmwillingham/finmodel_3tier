from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os

# Use environment variable DATABASE_URL or default to SQLite
# For PostgreSQL: set DATABASE_URL environment variable to "postgresql://user:pass@host/dbname"
# For SQLite: "sqlite:///./finmodel.db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finmodel.db")

# SQLite needs connect_args for check_same_thread
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    Dependency that yields a new database session and closes it afterwards.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
