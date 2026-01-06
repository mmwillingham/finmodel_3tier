#!/usr/bin/env python3
"""
Script to identify and optionally delete orphaned users from the database.

Usage:
    python cleanup_orphaned_users.py --list          # List users with their data counts
    python cleanup_orphaned_users.py --delete ID      # Delete a specific user by ID
    python cleanup_orphaned_users.py --delete-orphaned # Delete users with no data (DANGEROUS)
"""

import sys
import os
import argparse
from sqlalchemy.orm import Session
from sqlalchemy import func

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models
import database

def get_all_user_data_counts(db: Session) -> dict:
    """Get counts of all data for all users in bulk (much faster)."""
    # Use subqueries to get counts for all users at once
    from sqlalchemy import select
    
    # Get all user IDs
    user_ids = [u.id for u in db.query(models.User.id).all()]
    
    # Build counts dictionary using bulk queries
    counts = {user_id: {
        'projections': 0,
        'assets': 0,
        'liabilities': 0,
        'cash_flow_items': 0,
        'accounts': 0,
        'custom_charts': 0,
        'auto_disbursements': 0,
    } for user_id in user_ids}
    
    # Get all counts in bulk using GROUP BY
    projections = db.query(models.Projection.owner_id, func.count(models.Projection.id)).group_by(models.Projection.owner_id).all()
    for owner_id, count in projections:
        if owner_id in counts:
            counts[owner_id]['projections'] = count
    
    assets = db.query(models.Asset.owner_id, func.count(models.Asset.id)).group_by(models.Asset.owner_id).all()
    for owner_id, count in assets:
        if owner_id in counts:
            counts[owner_id]['assets'] = count
    
    liabilities = db.query(models.Liability.owner_id, func.count(models.Liability.id)).group_by(models.Liability.owner_id).all()
    for owner_id, count in liabilities:
        if owner_id in counts:
            counts[owner_id]['liabilities'] = count
    
    cash_flow_items = db.query(models.CashFlowItem.owner_id, func.count(models.CashFlowItem.id)).group_by(models.CashFlowItem.owner_id).all()
    for owner_id, count in cash_flow_items:
        if owner_id in counts:
            counts[owner_id]['cash_flow_items'] = count
    
    accounts = db.query(models.Account.owner_id, func.count(models.Account.id)).group_by(models.Account.owner_id).all()
    for owner_id, count in accounts:
        if owner_id in counts:
            counts[owner_id]['accounts'] = count
    
    custom_charts = db.query(models.CustomChart.user_id, func.count(models.CustomChart.id)).group_by(models.CustomChart.user_id).all()
    for user_id, count in custom_charts:
        if user_id in counts:
            counts[user_id]['custom_charts'] = count
    
    auto_disbursements = db.query(models.AutoDisbursement.owner_id, func.count(models.AutoDisbursement.id)).group_by(models.AutoDisbursement.owner_id).all()
    for owner_id, count in auto_disbursements:
        if owner_id in counts:
            counts[owner_id]['auto_disbursements'] = count
    
    return counts

def get_user_data_counts(db: Session, user_id: int) -> dict:
    """Get counts of all data associated with a specific user."""
    all_counts = get_all_user_data_counts(db)
    return all_counts.get(user_id, {
        'projections': 0,
        'assets': 0,
        'liabilities': 0,
        'cash_flow_items': 0,
        'accounts': 0,
        'custom_charts': 0,
        'auto_disbursements': 0,
    })

def list_users(db: Session):
    """List all users with their associated data counts."""
    print("Loading users...")
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    
    print(f"Calculating data counts for {len(users)} users (this may take a moment)...")
    all_counts = get_all_user_data_counts(db)
    
    print(f"\n{'ID':<5} {'Email':<40} {'Created':<20} {'Active':<8} {'Confirmed':<10} {'Data Counts'}")
    print("-" * 150)
    
    orphaned_count = 0
    for user in users:
        counts = all_counts.get(user.id, {
            'projections': 0, 'assets': 0, 'liabilities': 0, 'cash_flow_items': 0,
            'accounts': 0, 'custom_charts': 0, 'auto_disbursements': 0
        })
        total_data = sum(counts.values())
        counts_str = f"P:{counts['projections']} A:{counts['assets']} L:{counts['liabilities']} CF:{counts['cash_flow_items']} Acc:{counts['accounts']} Ch:{counts['custom_charts']} AD:{counts['auto_disbursements']}"
        
        is_orphaned = total_data == 0
        if is_orphaned:
            orphaned_count += 1
        
        print(f"{user.id:<5} {user.email:<40} {str(user.created_at)[:19]:<20} {str(user.is_active):<8} {str(user.is_confirmed):<10} {counts_str}", end="")
        if is_orphaned:
            print(" [ORPHANED]")
        else:
            print()
    
    print(f"\nTotal users: {len(users)}")
    print(f"Orphaned users (no data): {orphaned_count}")

def delete_user(db: Session, user_id: int, dry_run: bool = False):
    """Delete a specific user by ID."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user:
        print(f"Error: User with ID {user_id} not found.")
        return False
    
    print("Calculating data counts...")
    all_counts = get_all_user_data_counts(db)
    counts = all_counts.get(user_id, {
        'projections': 0, 'assets': 0, 'liabilities': 0, 'cash_flow_items': 0,
        'accounts': 0, 'custom_charts': 0, 'auto_disbursements': 0
    })
    total_data = sum(counts.values())
    
    print(f"\nUser to delete:")
    print(f"  ID: {user.id}")
    print(f"  Email: {user.email}")
    print(f"  Created: {user.created_at}")
    print(f"  Associated data:")
    for key, value in counts.items():
        if value > 0:
            print(f"    - {key}: {value}")
    
    if total_data > 0:
        print(f"\n  WARNING: This user has {total_data} associated records that will be deleted!")
    
    if dry_run:
        print(f"\n  [DRY RUN] Would delete user {user_id}")
        return True
    
    confirm = input(f"\nAre you sure you want to delete user {user_id} ({user.email})? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Deletion cancelled.")
        return False
    
    try:
        db.delete(user)
        db.commit()
        
        # Verify deletion
        verify = db.query(models.User).filter(models.User.id == user_id).first()
        if verify:
            print(f"ERROR: User {user_id} was not deleted!")
            db.rollback()
            return False
        else:
            print(f"Successfully deleted user {user_id} ({user.email})")
            return True
    except Exception as e:
        print(f"Error deleting user: {e}")
        db.rollback()
        return False

def delete_orphaned_users(db: Session, dry_run: bool = False):
    """Delete all users with no associated data."""
    print("Loading users and calculating data counts...")
    users = db.query(models.User).all()
    all_counts = get_all_user_data_counts(db)
    orphaned = []
    
    for user in users:
        counts = all_counts.get(user.id, {
            'projections': 0, 'assets': 0, 'liabilities': 0, 'cash_flow_items': 0,
            'accounts': 0, 'custom_charts': 0, 'auto_disbursements': 0
        })
        if sum(counts.values()) == 0:
            orphaned.append(user)
    
    if not orphaned:
        print("No orphaned users found.")
        return
    
    print(f"\nFound {len(orphaned)} orphaned users:")
    for user in orphaned:
        print(f"  - ID: {user.id}, Email: {user.email}, Created: {user.created_at}")
    
    if dry_run:
        print(f"\n[DRY RUN] Would delete {len(orphaned)} orphaned users")
        return
    
    confirm = input(f"\nAre you sure you want to delete {len(orphaned)} orphaned users? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Deletion cancelled.")
        return
    
    deleted_count = 0
    for user in orphaned:
        try:
            db.delete(user)
            deleted_count += 1
        except Exception as e:
            print(f"Error deleting user {user.id}: {e}")
            db.rollback()
            return
    
    db.commit()
    print(f"Successfully deleted {deleted_count} orphaned users.")

def main():
    parser = argparse.ArgumentParser(description='Cleanup orphaned users from the database')
    parser.add_argument('--list', action='store_true', help='List all users with their data counts')
    parser.add_argument('--delete', type=int, metavar='USER_ID', help='Delete a specific user by ID')
    parser.add_argument('--delete-orphaned', action='store_true', help='Delete all users with no associated data')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be deleted without actually deleting')
    
    args = parser.parse_args()
    
    if not any([args.list, args.delete, args.delete_orphaned]):
        parser.print_help()
        return
    
    db = next(database.get_db())
    
    try:
        if args.list:
            list_users(db)
        elif args.delete:
            delete_user(db, args.delete, dry_run=args.dry_run)
        elif args.delete_orphaned:
            delete_orphaned_users(db, dry_run=args.dry_run)
    finally:
        db.close()

if __name__ == '__main__':
    main()

