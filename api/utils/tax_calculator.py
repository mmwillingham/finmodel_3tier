"""
Federal Tax Calculator

Calculates federal income tax based on:
- Filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household)
- Age (65+ gets higher standard deduction)
- Taxable income (income minus deductions)
- Tax-deductible expenses
- Qualified dividends (taxed at capital gains rates: 0%, 15%, 20%)

Uses 2025 federal tax brackets and standard deductions.
"""

from typing import List, Tuple
from datetime import datetime


# 2025 Federal Tax Brackets (Single)
TAX_BRACKETS_SINGLE = [
    (0, 0.10),          # 10% up to $11,925
    (11925, 0.12),      # 12% from $11,925 to $48,475
    (48475, 0.22),      # 22% from $48,475 to $103,350
    (103350, 0.24),     # 24% from $103,350 to $197,300
    (197300, 0.32),     # 32% from $197,300 to $250,525
    (250525, 0.35),     # 35% from $250,525 to $626,350
    (626350, 0.37),     # 37% above $626,350
]

# 2025 Federal Tax Brackets (Married Filing Jointly)
TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.10),          # 10% up to $23,850
    (23850, 0.12),      # 12% from $23,850 to $96,950
    (96950, 0.22),      # 22% from $96,950 to $206,700
    (206700, 0.24),     # 24% from $206,700 to $394,600
    (394600, 0.32),     # 32% from $394,600 to $501,050
    (501050, 0.35),     # 35% from $501,050 to $752,700
    (752700, 0.37),     # 37% above $752,700
]

# 2025 Federal Tax Brackets (Married Filing Separately)
TAX_BRACKETS_MARRIED_SEPARATELY = [
    (0, 0.10),          # 10% up to $11,925
    (11925, 0.12),      # 12% from $11,925 to $48,475
    (48475, 0.22),      # 22% from $48,475 to $103,350
    (103350, 0.24),     # 24% from $103,350 to $197,300
    (197300, 0.32),     # 32% from $197,300 to $250,525
    (250525, 0.35),     # 35% from $250,525 to $376,350
    (376350, 0.37),     # 37% above $376,350
]

# 2025 Federal Tax Brackets (Head of Household)
TAX_BRACKETS_HEAD_OF_HOUSEHOLD = [
    (0, 0.10),          # 10% up to $17,000
    (17000, 0.12),      # 12% from $17,000 to $64,700
    (64700, 0.22),      # 22% from $64,700 to $103,350
    (103350, 0.24),     # 24% from $103,350 to $197,300
    (197300, 0.32),     # 32% from $197,300 to $250,525
    (250525, 0.35),     # 35% from $250,525 to $626,350
    (626350, 0.37),     # 37% above $626,350
]

# 2025 Standard Deductions
STANDARD_DEDUCTION_SINGLE = 14950
STANDARD_DEDUCTION_MARRIED_JOINTLY = 29900
STANDARD_DEDUCTION_MARRIED_SEPARATELY = 14950
STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD = 22400

# Additional standard deduction for age 65+ (2025)
ADDITIONAL_DEDUCTION_65_PLUS = 1900  # Per person 65 or older

# 2025 Qualified Dividend / Long-Term Capital Gains Tax Brackets
# These are the thresholds for determining the rate on qualified dividends
QUALIFIED_DIVIDEND_BRACKETS_SINGLE = [
    (0, 0.0),           # 0% up to $47,025
    (47025, 0.15),      # 15% from $47,025 to $518,900
    (518900, 0.20),     # 20% above $518,900
]

QUALIFIED_DIVIDEND_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.0),           # 0% up to $94,050
    (94050, 0.15),      # 15% from $94,050 to $583,750
    (583750, 0.20),     # 20% above $583,750
]

QUALIFIED_DIVIDEND_BRACKETS_MARRIED_SEPARATELY = [
    (0, 0.0),           # 0% up to $47,025
    (47025, 0.15),      # 15% from $47,025 to $291,850
    (291850, 0.20),     # 20% above $291,850
]

QUALIFIED_DIVIDEND_BRACKETS_HEAD_OF_HOUSEHOLD = [
    (0, 0.0),           # 0% up to $63,000
    (63000, 0.15),      # 15% from $63,000 to $551,350
    (551350, 0.20),     # 20% above $551,350
]


def get_tax_brackets(filing_status: str) -> List[Tuple[float, float]]:
    """Get tax brackets based on filing status."""
    status_map = {
        "Single": TAX_BRACKETS_SINGLE,
        "Married Filing Jointly": TAX_BRACKETS_MARRIED_JOINTLY,
        "Married Filing Separately": TAX_BRACKETS_MARRIED_SEPARATELY,
        "Head of Household": TAX_BRACKETS_HEAD_OF_HOUSEHOLD,
        "Qualifying Surviving Spouse": TAX_BRACKETS_MARRIED_JOINTLY,  # Uses same brackets as Married Filing Jointly
    }
    return status_map.get(filing_status, TAX_BRACKETS_SINGLE)


def get_qualified_dividend_brackets(filing_status: str) -> List[Tuple[float, float]]:
    """Get qualified dividend tax brackets based on filing status."""
    status_map = {
        "Single": QUALIFIED_DIVIDEND_BRACKETS_SINGLE,
        "Married Filing Jointly": QUALIFIED_DIVIDEND_BRACKETS_MARRIED_JOINTLY,
        "Married Filing Separately": QUALIFIED_DIVIDEND_BRACKETS_MARRIED_SEPARATELY,
        "Head of Household": QUALIFIED_DIVIDEND_BRACKETS_HEAD_OF_HOUSEHOLD,
        "Qualifying Surviving Spouse": QUALIFIED_DIVIDEND_BRACKETS_MARRIED_JOINTLY,  # Uses same brackets as Married Filing Jointly
    }
    return status_map.get(filing_status, QUALIFIED_DIVIDEND_BRACKETS_SINGLE)


def get_standard_deduction(filing_status: str, person1_age: int = 0, person2_age: int = 0) -> float:
    """Calculate standard deduction based on filing status and age."""
    base_deductions = {
        "Single": STANDARD_DEDUCTION_SINGLE,
        "Married Filing Jointly": STANDARD_DEDUCTION_MARRIED_JOINTLY,
        "Married Filing Separately": STANDARD_DEDUCTION_MARRIED_SEPARATELY,
        "Head of Household": STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD,
        "Qualifying Surviving Spouse": STANDARD_DEDUCTION_MARRIED_JOINTLY,  # Uses same deduction as Married Filing Jointly
    }
    
    base = base_deductions.get(filing_status, STANDARD_DEDUCTION_SINGLE)
    
    # Add age-based deductions
    additional = 0
    if filing_status == "Married Filing Jointly" or filing_status == "Qualifying Surviving Spouse":
        if person1_age >= 65:
            additional += ADDITIONAL_DEDUCTION_65_PLUS
        if person2_age >= 65:
            additional += ADDITIONAL_DEDUCTION_65_PLUS
    elif filing_status in ["Single", "Married Filing Separately", "Head of Household"]:
        if person1_age >= 65:
            additional += ADDITIONAL_DEDUCTION_65_PLUS
    
    return base + additional


def calculate_age_from_birthdate(birthdate: str, current_year: int = None) -> int:
    """Calculate age from birthdate string (YYYY-MM-DD format)."""
    if not birthdate:
        return 0
    
    try:
        birth_year = int(birthdate.split('-')[0])
        if current_year is None:
            current_year = datetime.now().year
        return current_year - birth_year
    except (ValueError, IndexError, AttributeError):
        return 0


def calculate_tax(
    taxable_income: float,
    filing_status: str,
    person1_birthdate: str = None,
    person2_birthdate: str = None,
    current_year: int = None,
) -> float:
    """
    Calculate federal income tax using progressive brackets.
    
    Args:
        taxable_income: Total taxable income (after deductions)
        filing_status: Tax filing status
        person1_birthdate: Birthdate of person 1 (YYYY-MM-DD format)
        person2_birthdate: Birthdate of person 2 (YYYY-MM-DD format, optional)
        current_year: Current year for age calculation (defaults to current year)
    
    Returns:
        Total federal income tax owed
    """
    import sys
    print(f"--- DEBUG calculate_tax: taxable_income={taxable_income}, filing_status={filing_status}, current_year={current_year} ---"); sys.stdout.flush()
    
    if taxable_income <= 0:
        print(f"--- DEBUG calculate_tax: Returning 0.0 because taxable_income <= 0 ---"); sys.stdout.flush()
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Calculate ages
    person1_age = calculate_age_from_birthdate(person1_birthdate, current_year)
    person2_age = calculate_age_from_birthdate(person2_birthdate, current_year) if person2_birthdate else 0
    
    # Get standard deduction (note: this is calculated but not used, as taxable_income already has deductions applied)
    standard_deduction = get_standard_deduction(filing_status, person1_age, person2_age)
    
    # Taxable income for calculation (should be after standard deduction)
    income_to_tax = max(0, taxable_income)  # Ensure non-negative
    
    # Get appropriate tax brackets
    brackets = get_tax_brackets(filing_status)
    print(f"--- DEBUG calculate_tax: income_to_tax={income_to_tax}, brackets={brackets} ---"); sys.stdout.flush()
    
    # Calculate tax using progressive brackets
    tax = 0.0
    previous_bracket = 0
    
    for i, (bracket_threshold, rate) in enumerate(brackets):
        if income_to_tax > previous_bracket:
            # Calculate amount in this bracket
            if i < len(brackets) - 1:
                # Not the last bracket
                next_threshold = brackets[i + 1][0]
                amount_in_bracket = min(income_to_tax, next_threshold) - previous_bracket
            else:
                # Last bracket (top bracket)
                amount_in_bracket = income_to_tax - previous_bracket
            
            print(f"--- DEBUG calculate_tax: Bracket {i}: threshold={bracket_threshold}, rate={rate}, previous_bracket={previous_bracket}, amount_in_bracket={amount_in_bracket} ---"); sys.stdout.flush()
            
            if amount_in_bracket > 0:
                bracket_tax = amount_in_bracket * rate
                tax += bracket_tax
                print(f"--- DEBUG calculate_tax: Bracket {i}: bracket_tax={bracket_tax}, cumulative_tax={tax} ---"); sys.stdout.flush()
                previous_bracket = brackets[i + 1][0] if i < len(brackets) - 1 else income_to_tax
        else:
            print(f"--- DEBUG calculate_tax: Breaking at bracket {i} because income_to_tax <= previous_bracket ---"); sys.stdout.flush()
            break
    
    final_tax = round(tax, 2)
    print(f"--- DEBUG calculate_tax: Final tax={final_tax} ---"); sys.stdout.flush()
    return final_tax


def calculate_qualified_dividend_tax(
    qualified_dividend_amount: float,
    total_taxable_income: float,
    filing_status: str,
    current_year: int = None,
) -> float:
    """
    Calculate tax on qualified dividends using capital gains rates.
    
    Qualified dividends are taxed at special rates (0%, 15%, 20%) based on the taxpayer's
    total taxable income. All qualified dividends are taxed at the same rate, which is
    determined by the taxpayer's total taxable income level.
    
    Args:
        qualified_dividend_amount: Amount of qualified dividends
        total_taxable_income: Total taxable income (ordinary income + qualified dividends, after deductions)
        filing_status: Tax filing status
        current_year: Current year (for consistency, though rates don't change mid-year)
    
    Returns:
        Tax owed on qualified dividends
    """
    if qualified_dividend_amount <= 0:
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Get qualified dividend brackets
    qd_brackets = get_qualified_dividend_brackets(filing_status)
    
    # Determine the rate based on total taxable income
    # All qualified dividends are taxed at the same rate, based on total taxable income
    rate = 0.0
    for i, (threshold, bracket_rate) in enumerate(qd_brackets):
        if i < len(qd_brackets) - 1:
            next_threshold = qd_brackets[i + 1][0]
            if total_taxable_income >= threshold and total_taxable_income < next_threshold:
                rate = bracket_rate
                break
        else:
            # Last bracket (top bracket)
            if total_taxable_income >= threshold:
                rate = bracket_rate
                break
    
    # Apply the rate to all qualified dividends
    tax = qualified_dividend_amount * rate
    
    return round(tax, 2)


def calculate_taxable_income(
    total_income: float,
    tax_deductible_expenses: float = 0.0,
    filing_status: str = "Single",
    person1_birthdate: str = None,
    person2_birthdate: str = None,
    current_year: int = None,
    qualified_dividends: float = 0.0,
) -> Tuple[float, float, float]:
    """
    Calculate taxable income and tax.
    
    Args:
        total_income: Total taxable income (sum of all income items with taxable=True, including qualified dividends)
        tax_deductible_expenses: Total tax-deductible expenses (sum of expenses with tax_deductible=True)
        filing_status: Tax filing status
        person1_birthdate: Birthdate of person 1 (YYYY-MM-DD format)
        person2_birthdate: Birthdate of person 2 (YYYY-MM-DD format, optional)
        current_year: Current year for age calculation
        qualified_dividends: Amount of qualified dividends (subset of total_income, taxed at capital gains rates)
    
    Returns:
        Tuple of (taxable_income, standard_deduction, tax_owed)
    """
    import sys
    print(f"--- DEBUG calculate_taxable_income: total_income={total_income}, tax_deductible_expenses={tax_deductible_expenses}, filing_status={filing_status}, current_year={current_year}, qualified_dividends={qualified_dividends} ---"); sys.stdout.flush()
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Calculate ages
    person1_age = calculate_age_from_birthdate(person1_birthdate, current_year)
    person2_age = calculate_age_from_birthdate(person2_birthdate, current_year) if person2_birthdate else 0
    print(f"--- DEBUG calculate_taxable_income: person1_age={person1_age}, person2_age={person2_age} ---"); sys.stdout.flush()
    
    # Get standard deduction
    standard_deduction = get_standard_deduction(filing_status, person1_age, person2_age)
    print(f"--- DEBUG calculate_taxable_income: standard_deduction={standard_deduction} ---"); sys.stdout.flush()
    
    # Calculate Adjusted Gross Income (AGI) = total income - tax deductible expenses
    agi = max(0, total_income - tax_deductible_expenses)
    print(f"--- DEBUG calculate_taxable_income: agi={agi} ---"); sys.stdout.flush()
    
    # Taxable income = AGI - standard deduction
    taxable_income = max(0, agi - standard_deduction)
    print(f"--- DEBUG calculate_taxable_income: taxable_income={taxable_income} ---"); sys.stdout.flush()
    
    # Separate ordinary income and qualified dividends
    # Note: qualified_dividends is already included in total_income, so we subtract it to get ordinary income
    ordinary_income = max(0, taxable_income - qualified_dividends)
    qualified_dividend_income = min(qualified_dividends, taxable_income)
    print(f"--- DEBUG calculate_taxable_income: ordinary_income={ordinary_income}, qualified_dividend_income={qualified_dividend_income} ---"); sys.stdout.flush()
    
    # Calculate tax on ordinary income
    print(f"--- DEBUG calculate_taxable_income: Calling calculate_tax with ordinary_income={ordinary_income} ---"); sys.stdout.flush()
    ordinary_tax = calculate_tax(ordinary_income, filing_status, person1_birthdate, person2_birthdate, current_year)
    print(f"--- DEBUG calculate_taxable_income: ordinary_tax={ordinary_tax} ---"); sys.stdout.flush()
    
    # Calculate tax on qualified dividends (if any)
    qualified_tax = 0.0
    if qualified_dividend_income > 0:
        qualified_tax = calculate_qualified_dividend_tax(
            qualified_dividend_income,
            taxable_income,
            filing_status,
            current_year
        )
        print(f"--- DEBUG calculate_taxable_income: qualified_tax={qualified_tax} ---"); sys.stdout.flush()
    
    # Total tax = tax on ordinary income + tax on qualified dividends
    tax_owed = ordinary_tax + qualified_tax
    print(f"--- DEBUG calculate_taxable_income: Final tax_owed={tax_owed} (ordinary_tax={ordinary_tax} + qualified_tax={qualified_tax}) ---"); sys.stdout.flush()
    
    return (taxable_income, standard_deduction, tax_owed)
