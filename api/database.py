import os
import time
from functools import lru_cache
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from typing import Any, Generator
from sqlalchemy.exc import OperationalError

_unix_socket_path: str | None = None # Global to store unix socket path if used

@lru_cache(maxsize=1)
def get_database_url() -> str:
    global _unix_socket_path # Declare intent to modify global variable
    database_url = os.getenv("DATABASE_URL")

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

        if not all([db_user, db_password, db_name]):
            raise ValueError("Missing one or more database environment variables (DB_USER, DB_PASSWORD, DB_NAME)")

        if cloud_sql_connection_name:
            db_host = os.getenv("DB_HOST", "127.0.0.1")

            if db_host.startswith("/cloudsql/"):
                _unix_socket_path = db_host # Store the unix socket path
                database_url = (
                    f"postgresql+pg8000://{db_user}:{db_password}@/{db_name}" # Note: no host here
                )
            else:
                db_port = os.getenv("DB_PORT", "5432")
                database_url = (
                    f"postgresql+pg8000://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
                )
        else:
            local_db_host = os.getenv("DB_HOST", "localhost")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )

    if database_url is None:
        raise ValueError("DATABASE_URL could not be determined from environment variables.")

    print(f"DEBUG (database.py): Constructed SYNC SQLALCHEMY_DATABASE_URL: {database_url}")
    return database_url

@lru_cache(maxsize=1)
def get_database_url() -> str:
    global _unix_socket_path # Declare intent to modify global variable
    database_url = os.getenv("DATABASE_URL")

    if database_url is None:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

        if not all([db_user, db_password, db_name]):
            raise ValueError("Missing one or more database environment variables (DB_USER, DB_PASSWORD, DB_NAME)")

        if cloud_sql_connection_name:
            db_host = os.getenv("DB_HOST", "127.0.0.1")

            if db_host.startswith("/cloudsql/"):
                _unix_socket_path = db_host # Store the unix socket path
                database_url = (
                    f"postgresql+pg8000://{db_user}:{db_password}@/{db_name}" # Note: no host here
                )
            else:
                db_port = os.getenv("DB_PORT", "5432")
                database_url = (
                    f"postgresql+pg8000://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
                )
        else:
            local_db_host = os.getenv("DB_HOST", "localhost")
            local_db_port = os.getenv("DB_PORT", "5432")
            database_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )

    if database_url is None:
        raise ValueError("DATABASE_URL could not be determined from environment variables.")

    print(f"DEBUG (database.py): Constructed SYNC SQLALCHEMY_DATABASE_URL: {database_url}")
    return database_url
