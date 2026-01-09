"""add_brokerage_table_and_link_accounts

Revision ID: brokerages_001
Revises: c9748e09dcce
Create Date: 2026-01-09 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
# Note: This migration should be run after consolidating migration branches if multiple heads exist
revision: str = 'brokerages_001'
down_revision: Union[str, Sequence[str], None] = 'c9748e09dcce'  # Update this to your actual latest migration head
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create brokerages table and migrate data from accounts."""
    # Create brokerages table
    op.create_table(
        'brokerages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('broker_name', sa.String(), nullable=True),
        sa.Column('broker_phone', sa.String(), nullable=True),
        sa.Column('broker_email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_brokerages_id'), 'brokerages', ['id'], unique=False)
    
    # Add brokerage_id column to accounts (nullable initially)
    op.add_column('accounts', sa.Column('brokerage_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_accounts_brokerage_id',
        'accounts', 'brokerages',
        ['brokerage_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Migrate existing data: Create brokerages from unique account combinations
    # Strategy: Process each account individually to find/create matching brokerage
    # This avoids NULL parameter type inference issues
    connection = op.get_bind()
    
    # Get all accounts that need brokerage assignment
    accounts_result = connection.execute(text("""
        SELECT 
            id,
            owner_id, 
            brokerage, 
            broker_name, 
            broker_phone, 
            broker_email
        FROM accounts
        WHERE brokerage IS NOT NULL
          AND brokerage_id IS NULL
        ORDER BY owner_id, brokerage
    """))
    
    for account_row in accounts_result:
        account_id, owner_id, brokerage_name, broker_name, broker_phone, broker_email = account_row
        
        # Find existing brokerage with exact match using dynamic WHERE clause
        # Build conditions list and params list separately to avoid type issues
        find_conditions = ["owner_id = :owner_id", "name = :name"]
        find_params_dict = {"owner_id": owner_id, "name": brokerage_name}
        
        # Handle NULL values by checking conditionally
        if broker_name is None:
            find_conditions.append("broker_name IS NULL")
        else:
            find_conditions.append("broker_name = :broker_name")
            find_params_dict["broker_name"] = broker_name
            
        if broker_phone is None:
            find_conditions.append("broker_phone IS NULL")
        else:
            find_conditions.append("broker_phone = :broker_phone")
            find_params_dict["broker_phone"] = broker_phone
            
        if broker_email is None:
            find_conditions.append("broker_email IS NULL")
        else:
            find_conditions.append("broker_email = :broker_email")
            find_params_dict["broker_email"] = broker_email
        
        find_sql = f"SELECT id FROM brokerages WHERE {' AND '.join(find_conditions)}"
        find_result = connection.execute(text(find_sql), find_params_dict)
        existing = find_result.fetchone()
        
        if existing:
            brokerage_id = existing[0]
        else:
            # Insert new brokerage
            insert_result = connection.execute(text("""
                INSERT INTO brokerages (owner_id, name, broker_name, broker_phone, broker_email, created_at)
                VALUES (:owner_id, :name, :broker_name, :broker_phone, :broker_email, now())
                RETURNING id
            """), {
                "owner_id": owner_id,
                "name": brokerage_name,
                "broker_name": broker_name,
                "broker_phone": broker_phone,
                "broker_email": broker_email
            })
            brokerage_id = insert_result.fetchone()[0]
        
        # Link this specific account to the brokerage
        connection.execute(text("""
            UPDATE accounts
            SET brokerage_id = :brokerage_id
            WHERE id = :account_id
        """), {"brokerage_id": brokerage_id, "account_id": account_id})
    
    # Note: Alembic handles transactions automatically, no need for manual commit


def downgrade() -> None:
    """Revert brokerage table and migration."""
    # Remove brokerage_id from accounts
    op.drop_constraint('fk_accounts_brokerage_id', 'accounts', type_='foreignkey')
    op.drop_column('accounts', 'brokerage_id')
    
    # Drop brokerages table
    op.drop_index(op.f('ix_brokerages_id'), table_name='brokerages')
    op.drop_table('brokerages')
