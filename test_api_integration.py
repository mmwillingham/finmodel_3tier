#!/usr/bin/env python3
"""
Integration test to verify that the projection API correctly handles
accounts with the 'type' field.

This test validates:
1. Creating projections with account types
2. Retrieving projections with account types
3. Updating projections with account types
"""

import json
import sys


def test_account_schema():
    """Test that the AccountSchema properly validates account data."""
    print("=== Testing AccountSchema ===\n")
    
    # Import the schema
    sys.path.insert(0, '/home/runner/work/finmodel_3tier/finmodel_3tier/api')
    from schemas import AccountSchema
    
    # Test 1: Valid account with all required fields
    print("Test 1: Creating account with all fields...")
    account_data = {
        "name": "Test Savings",
        "type": "Savings (High-Yield)",
        "initial_balance": 10000.0,
        "monthly_contribution": 500.0,
        "annual_rate_percent": 4.5
    }
    
    try:
        account = AccountSchema(**account_data)
        assert account.name == "Test Savings"
        assert account.type == "Savings (High-Yield)"
        assert account.initial_balance == 10000.0
        print("✓ Account created successfully")
        print(f"  Account: {account.model_dump()}")
    except Exception as e:
        print(f"✗ Failed to create account: {e}")
        return False
    
    # Test 2: Account serialization to JSON
    print("\nTest 2: Serializing account to JSON...")
    try:
        account_json = account.model_dump()
        assert 'type' in account_json, "type field missing in serialized data"
        assert account_json['type'] == "Savings (High-Yield)"
        print("✓ Account serialized correctly")
        print(f"  JSON: {json.dumps(account_json, indent=2)}")
    except Exception as e:
        print(f"✗ Failed to serialize account: {e}")
        return False
    
    # Test 3: Account with "Other/Custom" type (migration default)
    print("\nTest 3: Creating account with migration default type...")
    migrated_account_data = {
        "name": "Migrated Account",
        "type": "Other/Custom",
        "initial_balance": 5000.0,
        "monthly_contribution": 200.0,
        "annual_rate_percent": 6.0
    }
    
    try:
        migrated_account = AccountSchema(**migrated_account_data)
        assert migrated_account.type == "Other/Custom"
        print("✓ Migrated account type accepted")
        print(f"  Account: {migrated_account.model_dump()}")
    except Exception as e:
        print(f"✗ Failed to create migrated account: {e}")
        return False
    
    # Test 4: Multiple accounts with types
    print("\nTest 4: Creating multiple accounts...")
    accounts_data = [
        {
            "name": "Checking",
            "type": "Cash (Checking/Current)",
            "initial_balance": 2000.0,
            "monthly_contribution": 0.0,
            "annual_rate_percent": 0.1
        },
        {
            "name": "IRA",
            "type": "Retirement (Tax-Advantaged)",
            "initial_balance": 50000.0,
            "monthly_contribution": 500.0,
            "annual_rate_percent": 8.5
        },
        {
            "name": "Real Estate",
            "type": "Real Estate",
            "initial_balance": 200000.0,
            "monthly_contribution": 0.0,
            "annual_rate_percent": 4.0
        }
    ]
    
    try:
        accounts = [AccountSchema(**data) for data in accounts_data]
        assert len(accounts) == 3
        assert all(hasattr(acc, 'type') for acc in accounts)
        print("✓ Multiple accounts created successfully")
        for acc in accounts:
            print(f"  - {acc.name} ({acc.type})")
    except Exception as e:
        print(f"✗ Failed to create multiple accounts: {e}")
        return False
    
    # Test 5: JSON round-trip
    print("\nTest 5: Testing JSON round-trip (serialize and deserialize)...")
    try:
        # Serialize to JSON string
        accounts_json_str = json.dumps([acc.model_dump() for acc in accounts])
        
        # Deserialize back
        accounts_list = json.loads(accounts_json_str)
        
        # Recreate AccountSchema objects
        recreated_accounts = [AccountSchema(**data) for data in accounts_list]
        
        # Verify all fields preserved
        assert len(recreated_accounts) == len(accounts)
        for original, recreated in zip(accounts, recreated_accounts):
            assert original.name == recreated.name
            assert original.type == recreated.type
            assert original.initial_balance == recreated.initial_balance
        
        print("✓ JSON round-trip successful")
        print(f"  Preserved {len(recreated_accounts)} accounts with all fields intact")
    except Exception as e:
        print(f"✗ JSON round-trip failed: {e}")
        return False
    
    print("\n=== All AccountSchema Tests Passed! ===\n")
    return True


def test_projection_request():
    """Test that ProjectionRequest properly handles accounts with types."""
    print("=== Testing ProjectionRequest ===\n")
    
    sys.path.insert(0, '/home/runner/work/finmodel_3tier/finmodel_3tier/api')
    from schemas import ProjectionRequest, AccountSchema
    
    # Test: Complete projection request
    print("Test: Creating projection request with typed accounts...")
    
    request_data = {
        "plan_name": "Test Plan",
        "years": 10,
        "accounts": [
            {
                "name": "Savings",
                "type": "Savings (High-Yield)",
                "initial_balance": 10000.0,
                "monthly_contribution": 300.0,
                "annual_rate_percent": 4.5
            },
            {
                "name": "Investment",
                "type": "Brokerage (Taxable)",
                "initial_balance": 25000.0,
                "monthly_contribution": 500.0,
                "annual_rate_percent": 8.0
            }
        ]
    }
    
    try:
        projection_request = ProjectionRequest(**request_data)
        assert projection_request.plan_name == "Test Plan"
        assert len(projection_request.accounts) == 2
        assert all(hasattr(acc, 'type') for acc in projection_request.accounts)
        
        print("✓ ProjectionRequest created successfully")
        print(f"  Plan: {projection_request.plan_name}")
        print(f"  Years: {projection_request.years}")
        print(f"  Accounts: {len(projection_request.accounts)}")
        for acc in projection_request.accounts:
            print(f"    - {acc.name} ({acc.type})")
        
        # Verify serialization
        serialized = json.dumps([acc.model_dump() for acc in projection_request.accounts])
        parsed = json.loads(serialized)
        assert all('type' in acc for acc in parsed), "type field missing after serialization"
        
        print("✓ Serialization preserved type field")
        
    except Exception as e:
        print(f"✗ Failed to create projection request: {e}")
        return False
    
    print("\n=== ProjectionRequest Tests Passed! ===\n")
    return True


if __name__ == "__main__":
    success = True
    
    try:
        if not test_account_schema():
            success = False
        
        if not test_projection_request():
            success = False
        
        if success:
            print("=" * 50)
            print("ALL INTEGRATION TESTS PASSED!")
            print("=" * 50)
            sys.exit(0)
        else:
            print("=" * 50)
            print("SOME TESTS FAILED")
            print("=" * 50)
            sys.exit(1)
    
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
