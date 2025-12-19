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

import api.models # THIS IS CRUCIAL: Import your models to ensure metadata is populated
import api.database # NEW: Import database to get SQLALCHEMY_DATABASE_URL

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
    url = api.database.get_database_url()

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
    # Use environment variables directly for Cloud Build context
    db_user = os.getenv("DB_USER", "dbadmin")
    db_password = os.getenv("DB_PASSWORD") or os.getenv("_DB_PASSWORD", "bolaudersez88")
    db_name = os.getenv("DB_NAME", "finmodel1")
    # For Cloud Build, the proxy is usually accessible at 127.0.0.1:5432
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = os.getenv("DB_PORT", "5432")

    connectable_url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    print(f"DEBUG (alembic/env.py): Constructed ASYNC DATABASE_URL for migrations: {connectable_url}")

    # Use the retrieved URL to create the async engine
    connectable = async_engine_from_config(
        {'sqlalchemy.url': connectable_url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())