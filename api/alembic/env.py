import asyncio
import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import api.models
target_metadata = api.models.Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable_url = os.getenv("DATABASE_URL")

    if not connectable_url:
        db_user = os.getenv("DB_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD")
        db_name = os.getenv("DB_NAME")
        cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")
        use_cloud_sql_proxy_tcp = os.getenv("USE_CLOUD_SQL_PROXY_TCP", "False").lower() == "true"

        if not all([db_user, db_password, db_name]):
            raise ValueError("Missing one or more database environment variables (DB_USER, DB_PASSWORD, DB_NAME)")

        if use_cloud_sql_proxy_tcp: # Prioritize TCP connection if explicitly requested
            local_db_host = os.getenv("DB_HOST", "127.0.0.1")
            local_db_port = os.getenv("DB_PORT", "5432")
            connectable_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )
        elif cloud_sql_connection_name: # Fallback to Unix socket if cloud SQL connection name is provided and TCP is not explicitly requested
            unix_socket_path = f"/cloudsql/{cloud_sql_connection_name}/.s.PGSQL.5432"
            connectable_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@/{db_name}?unix_sock={unix_socket_path}"
            )
        else: # Regular local database connection without Cloud SQL Proxy
            local_db_host = os.getenv("DB_HOST", "localhost")
            local_db_port = os.getenv("DB_PORT", "5432")
            connectable_url = (
                f"postgresql+pg8000://{db_user}:{db_password}@{local_db_host}:{local_db_port}/{db_name}"
            )

    if connectable_url is None:
        raise ValueError("DATABASE_URL could not be determined from environment variables.")

    # Sanitize URL for logging (remove password)
    def sanitize_url(url: str) -> str:
        import re
        pattern = r'(://[^:]+:)([^@]+)(@)'
        return re.sub(pattern, r'\1***\3', url)

    # Determine if we should use async or sync engine based on the URL scheme
    if "asyncpg" in connectable_url:
        connectable = async_engine_from_config(
            {'sqlalchemy.url': connectable_url},
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
    else:
        connectable = engine_from_config(
            {'sqlalchemy.url': connectable_url},
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())