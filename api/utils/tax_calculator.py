"""
Federal Tax Calculator

Calculates federal income tax based on:
- Filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household)
- Age (65+ gets higher standard deduction)
- Taxable income (income minus deductions)
- Tax-deductible expenses

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
    if taxable_income <= 0:
        return 0.0
    
    if current_year is None:
        current_year = datetime.now().year
    
    # Calculate ages
    person1_age = calculate_age_from_birthdate(person1_birthdate, current_year)
    person2_age = calculate_age_from_birthdate(person2_birthdate, current_year) if person2_birthdate else 0
    
    # Get standard deduction
    standard_deduction = get_standard_deduction(filing_status, person1_age, person2_age)
    
    # Adjusted gross income (AGI) = taxable_income + standard_deduction (assuming we're given taxable income after standard deduction)
    # Actually, if taxable_income is already after deductions, we use it directly
    # But we need to check: taxable_income should be AFTER standard deduction
    # For now, assume taxable_income is the AGI minus deductions
    # So AGI = taxable_income + deductions
    # But we want to calculate tax on taxable_income (which is AGI - deductions)
    
    # Taxable income for calculation (should be after standard deduction)
    # If the input is already taxable income (after deductions), use it
    # Otherwise, we'd subtract standard deduction first, but we assume it's already done
    
    income_to_tax = max(0, taxable_income)  # Ensure non-negative
    
    # Get appropriate tax brackets
    brackets = get_tax_brackets(filing_status)
    
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
            
            if amount_in_bracket > 0:
                tax += amount_in_bracket * rate
                previous_bracket = brackets[i + 1][0] if i < len(brackets) - 1 else income_to_tax
        else:
            break
    
    return round(tax, 2)


def calculate_taxable_income(
    total_income: float,
    tax_deductible_expenses: float = 0.0,
    filing_status: str = "Single",
    person1_birthdate: str = None,
    person2_birthdate: str = None,
    current_year: int = None,
) -> Tuple[float, float, float]:
    """
    Calculate taxable income and tax.
    
    Args:
        total_income: Total taxable income (sum of all income items with taxable=True)
        tax_deductible_expenses: Total tax-deductible expenses (sum of expenses with tax_deductible=True)
        filing_status: Tax filing status
        person1_birthdate: Birthdate of person 1 (YYYY-MM-DD format)
        person2_birthdate: Birthdate of person 2 (YYYY-MM-DD format, optional)
        current_year: Current year for age calculation
    
    Returns:
        Tuple of (taxable_income, standard_deduction, tax_owed)
    """
    if current_year is None:
        current_year = datetime.now().year
    
    # Calculate ages
    person1_age = calculate_age_from_birthdate(person1_birthdate, current_year)
    person2_age = calculate_age_from_birthdate(person2_birthdate, current_year) if person2_birthdate else 0
    
    # Get standard deduction
    standard_deduction = get_standard_deduction(filing_status, person1_age, person2_age)
    
    # Calculate Adjusted Gross Income (AGI) = total income - tax deductible expenses
    agi = max(0, total_income - tax_deductible_expenses)
    
    # Taxable income = AGI - standard deduction
    taxable_income = max(0, agi - standard_deduction)
    
    # Calculate tax
    tax_owed = calculate_tax(taxable_income, filing_status, person1_birthdate, person2_birthdate, current_year)
    
    return (taxable_income, standard_deduction, tax_owed)
