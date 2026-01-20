"""
Federal and State Tax Calculator

Calculates federal and state income tax based on:
- Filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household)
- Age (65+ gets higher standard deduction)
- Taxable income (income minus deductions)
- Tax-deductible expenses
- Qualified dividends (taxed at capital gains rates: 0%, 15%, 20%)
- State of residence

Uses 2025 federal and state tax brackets and standard deductions.
"""

from typing import List, Tuple, Optional
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

# 2025 State Tax Brackets - California (progressive)
# California uses same brackets for all filing statuses (tax is calculated per person for MFJ)
CALIFORNIA_TAX_BRACKETS = [
    (0, 0.01),          # 1% up to $10,099
    (10099, 0.02),      # 2% from $10,099 to $23,942
    (23942, 0.04),      # 4% from $23,942 to $37,788
    (37788, 0.06),      # 6% from $37,788 to $52,455
    (52455, 0.08),      # 8% from $52,455 to $66,295
    (66295, 0.093),     # 9.3% from $66,295 to $338,639
    (338639, 0.103),    # 10.3% from $338,639 to $406,364
    (406364, 0.113),    # 11.3% from $406,364 to $677,275
    (677275, 0.123),    # 12.3% above $677,275
]

CALIFORNIA_STANDARD_DEDUCTION = {
    "Single": 5540,
    "Married Filing Jointly": 11080,
    "Married Filing Separately": 5540,
    "Head of Household": 11080,
}

# 2025 State Tax Brackets - New York (progressive, varies by filing status)
NEW_YORK_TAX_BRACKETS_SINGLE = [
    (0, 0.04),          # 4% up to $8,500
    (8500, 0.045),      # 4.5% from $8,500 to $11,700
    (11700, 0.0525),    # 5.25% from $11,700 to $13,900
    (13900, 0.055),     # 5.5% from $13,900 to $21,400
    (21400, 0.06),      # 6% from $21,400 to $80,650
    (80650, 0.0685),    # 6.85% from $80,650 to $215,400
    (215400, 0.0965),   # 9.65% from $215,400 to $1,077,550
    (1077550, 0.103),   # 10.3% from $1,077,550 to $5,000,000
    (5000000, 0.109),   # 10.9% above $5,000,000
]

NEW_YORK_TAX_BRACKETS_MARRIED_JOINTLY = [
    (0, 0.04),          # 4% up to $17,150
    (17150, 0.045),     # 4.5% from $17,150 to $23,600
    (23600, 0.0525),    # 5.25% from $23,600 to $27,900
    (27900, 0.055),     # 5.5% from $27,900 to $43,000
    (43000, 0.06),      # 6% from $43,000 to $161,550
    (161550, 0.0685),   # 6.85% from $161,550 to $323,200
    (323200, 0.0965),   # 9.65% from $323,200 to $2,155,350
    (2155350, 0.103),   # 10.3% from $2,155,350 to $5,000,000
    (5000000, 0.109),   # 10.9% above $5,000,000
]

NEW_YORK_STANDARD_DEDUCTION = {
    "Single": 8000,
    "Married Filing Jointly": 16050,
    "Married Filing Separately": 8000,
    "Head of Household": 11200,
}

# 2025 State Tax Brackets - Georgia (progressive, flat rate structure)
# Georgia uses a flat rate of 5.49% for all income over $7,000 (2025)
# However, there's a tiered structure with different rates for different income levels
GEORGIA_TAX_BRACKETS = [
    (0, 0.01),          # 1% up to $750
    (750, 0.02),        # 2% from $750 to $2,250
    (2250, 0.03),       # 3% from $2,250 to $3,750
    (3750, 0.04),       # 4% from $3,750 to $5,250
    (5250, 0.05),       # 5% from $5,250 to $7,000
    (7000, 0.0549),     # 5.49% above $7,000 (flat rate for all income above threshold)
]

GEORGIA_STANDARD_DEDUCTION = {
    "Single": 5400,
    "Married Filing Jointly": 7100,
    "Married Filing Separately": 3550,
    "Head of Household": 7100,
}

# States with no income tax
NO_INCOME_TAX_STATES = [
    "Texas", "TX",
    "Florida", "FL",
    "Nevada", "NV",
    "South Dakota", "SD",
    "Washington", "WA",
    "Wyoming", "WY",
    "Tennessee", "TN",  # Only taxes interest and dividends, not wages
    "New Hampshire", "NH",  # Only taxes interest and dividends, not wages
]

# Helper function to normalize state name
def normalize_state_name(state: Optional[str]) -> Optional[str]:
    """Normalize state name to full name."""
    if not state:
        return None
    
    state_upper = state.upper().strip()
    
    # Map abbreviations to full names
    state_map = {
        "CA": "California",
        "NY": "New York",
        "GA": "Georgia",
        "TX": "Texas",
        "FL": "Florida",
        "NV": "Nevada",
        "SD": "South Dakota",
        "WA": "Washington",
        "WY": "Wyoming",
        "TN": "Tennessee",
        "NH": "New Hampshire",
    }
    
    # Check if it's an abbreviation
    if state_upper in state_map:
        return state_map[state_upper]
    
    # Check if it matches a full name (case-insensitive)
    for abbrev, full_name in state_map.items():
        if state_upper == full_name.upper():
            return full_name
    
    # Return original if not found
    return state


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


def get_state_tax_brackets(state: str, filing_status: str) -> Optional[List[Tuple[float, float]]]:
    """Get state tax brackets based on state and filing status."""
    normalized_state = normalize_state_name(state)
    
    if not normalized_state:
        return None
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        return None
    
    # California uses same brackets for all filing statuses
    if normalized_state == "California":
        return CALIFORNIA_TAX_BRACKETS
    
    # New York has different brackets by filing status
    if normalized_state == "New York":
        if filing_status == "Married Filing Jointly":
            return NEW_YORK_TAX_BRACKETS_MARRIED_JOINTLY
        else:
            return NEW_YORK_TAX_BRACKETS_SINGLE
    
    # Georgia uses same brackets for all filing statuses
    if normalized_state == "Georgia":
        return GEORGIA_TAX_BRACKETS
    
    # Add more states here as needed
    return None


def get_state_standard_deduction(state: str, filing_status: str) -> float:
    """Get state standard deduction based on state and filing status."""
    normalized_state = normalize_state_name(state)
    
    if not normalized_state:
        return 0.0
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        return 0.0
    
    if normalized_state == "California":
        return CALIFORNIA_STANDARD_DEDUCTION.get(filing_status, 0.0)
    
    if normalized_state == "New York":
        return NEW_YORK_STANDARD_DEDUCTION.get(filing_status, 0.0)
    
    if normalized_state == "Georgia":
        return GEORGIA_STANDARD_DEDUCTION.get(filing_status, 0.0)
    
    # Add more states here as needed
    return 0.0


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


def calculate_state_tax(
    taxable_income: float,
    state: str,
    filing_status: str,
    current_year: int = None,
) -> float:
    """
    Calculate state income tax using progressive brackets.
    
    Args:
        taxable_income: Total taxable income (after federal deductions, typically after state deductions too)
        state: State of residence (full name or abbreviation)
        filing_status: Tax filing status
        current_year: Current year (for future use if rates change by year)
    
    Returns:
        Total state income tax owed (0.0 if state has no income tax)
    """
    import sys
    print(f"--- DEBUG calculate_state_tax: taxable_income={taxable_income}, state={state}, filing_status={filing_status}, current_year={current_year} ---"); sys.stdout.flush()
    
    if taxable_income <= 0:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because taxable_income <= 0 ---"); sys.stdout.flush()
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    normalized_state = normalize_state_name(state)
    if not normalized_state:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because state is invalid/empty ---"); sys.stdout.flush()
        return 0.0
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because {normalized_state} has no income tax ---"); sys.stdout.flush()
        return 0.0
    
    # Get state tax brackets
    brackets = get_state_tax_brackets(normalized_state, filing_status)
    if not brackets:
        print(f"--- DEBUG calculate_state_tax: Returning 0.0 because no brackets found for {normalized_state} ---"); sys.stdout.flush()
        return 0.0
    
    # California: For Married Filing Jointly, divide income by 2 (community property state)
    income_to_tax = taxable_income
    if normalized_state == "California" and filing_status == "Married Filing Jointly":
        income_to_tax = taxable_income / 2.0
        print(f"--- DEBUG calculate_state_tax: California MFJ - dividing income by 2: {taxable_income} -> {income_to_tax} ---"); sys.stdout.flush()
    
    income_to_tax = max(0, income_to_tax)  # Ensure non-negative
    print(f"--- DEBUG calculate_state_tax: income_to_tax={income_to_tax}, brackets={brackets} ---"); sys.stdout.flush()
    
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
            
            print(f"--- DEBUG calculate_state_tax: Bracket {i}: threshold={bracket_threshold}, rate={rate}, previous_bracket={previous_bracket}, amount_in_bracket={amount_in_bracket} ---"); sys.stdout.flush()
            
            if amount_in_bracket > 0:
                bracket_tax = amount_in_bracket * rate
                tax += bracket_tax
                print(f"--- DEBUG calculate_state_tax: Bracket {i}: bracket_tax={bracket_tax}, cumulative_tax={tax} ---"); sys.stdout.flush()
                previous_bracket = brackets[i + 1][0] if i < len(brackets) - 1 else income_to_tax
        else:
            print(f"--- DEBUG calculate_state_tax: Breaking at bracket {i} because income_to_tax <= previous_bracket ---"); sys.stdout.flush()
            break
    
    # California: Multiply by 2 for MFJ (since we divided by 2 earlier)
    if normalized_state == "California" and filing_status == "Married Filing Jointly":
        tax = tax * 2.0
        print(f"--- DEBUG calculate_state_tax: California MFJ - multiplying tax by 2: {tax} ---"); sys.stdout.flush()
    
    final_tax = round(tax, 2)
    print(f"--- DEBUG calculate_state_tax: Final tax={final_tax} ---"); sys.stdout.flush()
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


def calculate_state_taxable_income(
    total_income: float,
    tax_deductible_expenses: float = 0.0,
    state: str = None,
    filing_status: str = "Single",
    federal_tax_owed: float = 0.0,
    current_year: int = None,
) -> Tuple[float, float, float]:
    """
    Calculate state taxable income and state tax.
    
    Note: State taxes are typically based on federal AGI (with state-specific adjustments),
    but some states allow deducting federal tax paid. For simplicity, we'll use federal taxable income
    as the starting point, with state-specific standard deductions.
    
    Args:
        total_income: Total taxable income (sum of all income items with taxable=True)
        tax_deductible_expenses: Total tax-deductible expenses (sum of expenses with tax_deductible=True)
        state: State of residence (full name or abbreviation)
        filing_status: Tax filing status
        federal_tax_owed: Federal tax owed (some states allow deducting this)
        current_year: Current year for calculation
    
    Returns:
        Tuple of (state_taxable_income, state_standard_deduction, state_tax_owed)
    """
    import sys
    print(f"--- DEBUG calculate_state_taxable_income: total_income={total_income}, tax_deductible_expenses={tax_deductible_expenses}, state={state}, filing_status={filing_status}, federal_tax_owed={federal_tax_owed}, current_year={current_year} ---"); sys.stdout.flush()
    
    if current_year is None:
        current_year = datetime.now().year
    
    normalized_state = normalize_state_name(state)
    if not normalized_state:
        print(f"--- DEBUG calculate_state_taxable_income: Returning zeros because state is invalid/empty ---"); sys.stdout.flush()
        return (0.0, 0.0, 0.0)
    
    # Check if state has no income tax
    if normalized_state.upper() in [s.upper() for s in NO_INCOME_TAX_STATES]:
        print(f"--- DEBUG calculate_state_taxable_income: Returning zeros because {normalized_state} has no income tax ---"); sys.stdout.flush()
        return (0.0, 0.0, 0.0)
    
    # Get state standard deduction
    state_standard_deduction = get_state_standard_deduction(normalized_state, filing_status)
    print(f"--- DEBUG calculate_state_taxable_income: state_standard_deduction={state_standard_deduction} ---"); sys.stdout.flush()
    
    # Calculate Adjusted Gross Income (AGI) = total income - tax deductible expenses
    agi = max(0, total_income - tax_deductible_expenses)
    print(f"--- DEBUG calculate_state_taxable_income: agi={agi} ---"); sys.stdout.flush()
    
    # State taxable income = AGI - state standard deduction
    # Note: Some states allow deducting federal tax, but we'll keep it simple for now
    state_taxable_income = max(0, agi - state_standard_deduction)
    print(f"--- DEBUG calculate_state_taxable_income: state_taxable_income={state_taxable_income} ---"); sys.stdout.flush()
    
    # Calculate state tax
    state_tax_owed = calculate_state_tax(
        state_taxable_income,
        normalized_state,
        filing_status,
        current_year
    )
    print(f"--- DEBUG calculate_state_taxable_income: Final state_tax_owed={state_tax_owed} ---"); sys.stdout.flush()
    
    return (state_taxable_income, state_standard_deduction, state_tax_owed)
