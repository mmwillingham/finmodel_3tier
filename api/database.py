import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from typing import Any, Generator

def get_database_url() -> str:
    """Constructs and returns a synchronous database URL (e.g., with pg8000) based on environment variables.
    Prioritizes DATABASE_URL if provided as a single environment variable.
    """
    database_url = os.getenv("DATABASE_URL")

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

        if not all([db_user, db_password, db_name]):
            # CLOUD_SQL_CONNECTION_NAME is optional for local development
            raise ValueError("Missing one or more database environment variables (DB_USER, DB_PASSWORD, DB_NAME)")

        if cloud_sql_connection_name:
            # Use Unix socket path for Cloud SQL Proxy in Cloud Run
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@/{db_name}"
                f"?unix_sock=/cloudsql/{cloud_sql_connection_name}/.s.PGSQL.5432"
            )
        else:
            local_db_host = os.getenv("LOCAL_DB_HOST", "127.0.0.1")
            local_db_port = os.getenv("LOCAL_DB_PORT", "5432")
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
    
    if database_url is None:
        raise ValueError("DATABASE_URL could not be determined from environment variables.")

    print(f"DEBUG (database.py): Constructed SYNC SQLALCHEMY_DATABASE_URL: {database_url}")
    return database_url

def get_async_database_url() -> str:
    """Constructs and returns an asynchronous database URL (e.g., with asyncpg) based on environment variables.
    Prioritizes DATABASE_URL if provided as a single environment variable.
    This is intended for asynchronous operations like Alembic migrations.
    """
    database_url = os.getenv("DATABASE_URL") # Check if a single DATABASE_URL is provided

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

        if not all([db_user, db_password, db_name, cloud_sql_connection_name]):
            raise ValueError("Missing one or more database environment variables for async URL (DB_USER, DB_PASSWORD, DB_NAME, CLOUD_SQL_CONNECTION_NAME)")

        if cloud_sql_connection_name:
            db_host = os.getenv("DB_HOST", "127.0.0.1")
            db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
            )
        else:
            local_db_host = os.getenv("LOCAL_DB_HOST", "127.0.0.1")
            local_db_port = os.getenv("LOCAL_DB_PORT", "5432")
            database_url = (
                f"postgresql+asyncpg://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
    if database_url is None:
        raise ValueError("ASYNC DATABASE_URL could not be determined from environment variables.")
    print(f"DEBUG (database.py): Constructed ASYNC SQLALCHEMY_DATABASE_URL: {database_url}")
    return database_url


def get_engine():
    return create_engine(get_database_url())

def get_session_local():
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()