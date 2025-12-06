from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Replace with your actual connection string (Host, Port, User, Password, DB Name)
SQLALCHEMY_DATABASE_URL = "postgresql://bolauder:iamhe123@127.0.0.1/finmodel" 

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
