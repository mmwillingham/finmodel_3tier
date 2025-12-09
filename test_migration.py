#!/usr/bin/env python3
"""
Test script to validate the account type migration logic.
This script simulates the JSON transformation without requiring a database.
"""

import json
from typing import List, Dict, Any


def add_type_to_accounts(accounts_json: str, default_type: str = "Other/Custom") -> str:
    """
    Adds a 'type' field to each account in the accounts_json if it doesn't exist.
    
    Args:
        accounts_json: JSON string containing an array of account objects
        default_type: The default type to add to accounts missing the field
    
    Returns:
        Updated JSON string with type field added to all accounts
    """
    if not accounts_json or accounts_json in ['', '[]']:
        return accounts_json
    
    try:
        accounts = json.loads(accounts_json)
        
        if not isinstance(accounts, list):
            return accounts_json
        
        updated_accounts = []
        for account in accounts:
            if not isinstance(account, dict):
                updated_accounts.append(account)
                continue
            
            # Add type if it doesn't exist
            if 'type' not in account:
                account['type'] = default_type
            
            updated_accounts.append(account)
        
        return json.dumps(updated_accounts)
    
    except json.JSONDecodeError:
        print(f"Warning: Invalid JSON: {accounts_json}")
        return accounts_json


def test_add_type_to_accounts():
    """Run test cases for the add_type_to_accounts function."""
    
    print("=== Testing Account Type Migration Logic ===\n")
    
    # Test 1: Normal case - accounts without type
    test1 = '[{"name": "Savings", "initial_balance": 1000, "monthly_contribution": 100, "annual_rate_percent": 5.0}]'
    result1 = add_type_to_accounts(test1)
    parsed1 = json.loads(result1)
    assert 'type' in parsed1[0], "Test 1 failed: type field not added"
    assert parsed1[0]['type'] == "Other/Custom", "Test 1 failed: wrong default type"
    print("✓ Test 1 passed: Single account without type")
    
    # Test 2: Multiple accounts without type
    test2 = '''[
        {"name": "Account 1", "initial_balance": 1000, "monthly_contribution": 100, "annual_rate_percent": 5.0},
        {"name": "Account 2", "initial_balance": 2000, "monthly_contribution": 200, "annual_rate_percent": 7.0}
    ]'''
    result2 = add_type_to_accounts(test2)
    parsed2 = json.loads(result2)
    assert len(parsed2) == 2, "Test 2 failed: wrong number of accounts"
    assert all('type' in acc for acc in parsed2), "Test 2 failed: not all accounts have type"
    print("✓ Test 2 passed: Multiple accounts without type")
    
    # Test 3: Account already has type - should not change
    test3 = '[{"name": "Savings", "type": "Savings (High-Yield)", "initial_balance": 1000}]'
    result3 = add_type_to_accounts(test3)
    parsed3 = json.loads(result3)
    assert parsed3[0]['type'] == "Savings (High-Yield)", "Test 3 failed: existing type was changed"
    print("✓ Test 3 passed: Account with existing type unchanged")
    
    # Test 4: Mixed - some accounts have type, some don't
    test4 = '''[
        {"name": "Account 1", "type": "Cash (Checking/Current)", "initial_balance": 1000},
        {"name": "Account 2", "initial_balance": 2000}
    ]'''
    result4 = add_type_to_accounts(test4)
    parsed4 = json.loads(result4)
    assert parsed4[0]['type'] == "Cash (Checking/Current)", "Test 4 failed: existing type changed"
    assert parsed4[1]['type'] == "Other/Custom", "Test 4 failed: missing type not added"
    print("✓ Test 4 passed: Mixed accounts (some with, some without type)")
    
    # Test 5: Empty JSON
    test5 = '[]'
    result5 = add_type_to_accounts(test5)
    assert result5 == '[]', "Test 5 failed: empty array changed"
    print("✓ Test 5 passed: Empty JSON array")
    
    # Test 6: Null/None case
    test6 = ''
    result6 = add_type_to_accounts(test6)
    assert result6 == '', "Test 6 failed: empty string changed"
    print("✓ Test 6 passed: Empty string")
    
    # Test 7: Complex account with many fields
    test7 = '''[{
        "name": "Complex Account",
        "initial_balance": 50000,
        "monthly_contribution": 1000,
        "annual_rate_percent": 8.5,
        "custom_field": "value",
        "another_field": 123
    }]'''
    result7 = add_type_to_accounts(test7)
    parsed7 = json.loads(result7)
    assert 'type' in parsed7[0], "Test 7 failed: type not added to complex account"
    assert 'custom_field' in parsed7[0], "Test 7 failed: custom field lost"
    assert parsed7[0]['custom_field'] == "value", "Test 7 failed: custom field value changed"
    print("✓ Test 7 passed: Complex account with multiple fields")
    
    print("\n=== All Tests Passed! ===\n")
    
    # Print example transformation
    print("Example transformation:")
    print("\nBEFORE:")
    example_before = '''[
    {
        "name": "Main Savings",
        "initial_balance": 10000,
        "monthly_contribution": 200,
        "annual_rate_percent": 4.5
    },
    {
        "name": "Retirement IRA",
        "initial_balance": 25000,
        "monthly_contribution": 500,
        "annual_rate_percent": 8.5
    }
]'''
    print(example_before)
    
    print("\nAFTER:")
    example_after = add_type_to_accounts(example_before)
    print(json.dumps(json.loads(example_after), indent=4))


if __name__ == "__main__":
    test_add_type_to_accounts()
