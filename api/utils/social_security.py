"""
Social Security Benefit Calculator

Calculates Social Security benefits based on:
- Full Retirement Age (FRA) based on birth year
- Primary Insurance Amount (PIA)
- Retirement date (early, on-time, or delayed)
- COLA adjustments

Based on Social Security Administration rules.
"""

from datetime import date, datetime
from typing import Tuple, Optional


def calculate_fra(birth_year: int) -> Tuple[int, int]:
    """
    Calculate Full Retirement Age (FRA) based on birth year.
    
    Args:
        birth_year: Year of birth
    
    Returns:
        Tuple of (years, months) representing FRA
    """
    if birth_year >= 1960:
        return (67, 0)
    elif birth_year == 1959:
        return (66, 10)
    elif birth_year == 1958:
        return (66, 8)
    elif birth_year == 1957:
        return (66, 6)
    elif birth_year == 1956:
        return (66, 4)
    elif birth_year == 1955:
        return (66, 2)
    elif 1943 <= birth_year <= 1954:
        return (66, 0)
    else:
        # For years before 1943, FRA is 65
        return (65, 0)


def fra_to_date(birth_date: str) -> Optional[date]:
    """
    Calculate the Full Retirement Age date from birth date.
    
    Args:
        birth_date: Birth date in YYYY-MM-DD format
    
    Returns:
        FRA date as date object, or None if invalid
    """
    try:
        birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
        birth_year = birth.year
        fra_years, fra_months = calculate_fra(birth_year)
        
        # Calculate FRA date
        fra_date = date(
            birth.year + fra_years,
            birth.month + fra_months,
            birth.day
        )
        # Handle month overflow (e.g., if month > 12)
        if fra_date.month > 12:
            fra_date = date(
                fra_date.year + 1,
                fra_date.month - 12,
                fra_date.day
            )
        
        return fra_date
    except (ValueError, AttributeError):
        return None


def calculate_monthly_benefit(
    pia: float,
    retirement_date: str,
    fra_date: Optional[date],
    birth_date: Optional[str] = None
) -> float:
    """
    Calculate Social Security monthly benefit based on PIA, retirement date, and FRA.
    
    Args:
        pia: Primary Insurance Amount (full retirement benefit)
        retirement_date: Retirement date in YYYY-MM-DD format
        fra_date: Full Retirement Age date (can be calculated if None and birth_date provided)
        birth_date: Birth date in YYYY-MM-DD format (used if fra_date is None)
    
    Returns:
        Monthly benefit amount
    """
    if pia <= 0:
        return 0.0
    
    try:
        ret_date = datetime.strptime(retirement_date, "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return pia  # Return PIA if invalid date
    
    # Calculate FRA date if not provided
    if fra_date is None and birth_date:
        fra_date = fra_to_date(birth_date)
    
    if fra_date is None:
        return pia  # Return PIA if we can't calculate FRA
    
    # Calculate months between retirement date and FRA
    months_diff = (ret_date.year - fra_date.year) * 12 + (ret_date.month - fra_date.month)
    
    # Adjust benefit based on retirement date relative to FRA
    if months_diff < 0:
        # Early retirement (before FRA)
        months_early = abs(months_diff)
        
        # Reduction: 5/9 of 1% per month up to 36 months
        reduction = 0.0
        if months_early <= 36:
            reduction = months_early * (5/9) * 0.01
        else:
            # 5/9 of 1% for first 36 months
            reduction = 36 * (5/9) * 0.01
            # 5/12 of 1% for each additional month
            reduction += (months_early - 36) * (5/12) * 0.01
        
        benefit = pia * (1 - reduction)
        
    elif months_diff > 0:
        # Delayed retirement (after FRA)
        # Calculate age at retirement
        if birth_date:
            try:
                birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
                age_at_retirement = (ret_date.year - birth.year) - ((ret_date.month, ret_date.day) < (birth.month, birth.day))
            except (ValueError, AttributeError):
                age_at_retirement = 70  # Default to 70
        else:
            # Estimate age at retirement (assume they were born at FRA - 66 or 67)
            age_at_retirement = fra_date.year - (fra_date.year - 67) + (ret_date.year - fra_date.year)
        
        # Delay credits: 2/3 of 1% per month for every month past FRA until age 70
        # After age 70, no additional credits
        if age_at_retirement >= 70:
            months_delay = min(months_diff, (70 - (fra_date.year - birth.year)) * 12) if birth_date else min(months_diff, 36)
        else:
            months_delay = months_diff
        
        increase = months_delay * (2/3) * 0.01
        benefit = pia * (1 + increase)
        
    else:
        # Exactly at FRA
        benefit = pia
    
    return round(benefit, 2)


def calculate_spousal_benefit(
    person1_pia: float,
    person2_retirement_date: str,
    person2_fra_date: Optional[date] = None,
    person2_birth_date: Optional[str] = None
) -> float:
    """
    Calculate Person 2's spousal Social Security benefit (based on Person 1's PIA).
    
    Spousal benefit is 32.5-50% of Person 1's PIA, depending on when Person 2 claims
    relative to Person 2's own FRA (not Person 1's FRA).
    
    Base amount: 50% of Person 1's PIA
    - If claiming before Person 2's FRA:
      * First 36 months: reduced by 25/36 of 1% per month
      * After 36 months: reduced by 5/12 of 1% per month
      * Minimum at age 62: 32.5% of Person 1's PIA
    - If claiming at or after Person 2's FRA: 50% of Person 1's PIA
    
    Args:
        person1_pia: Person 1's PIA (Primary Insurance Amount)
        person2_retirement_date: Person 2's retirement date in YYYY-MM-DD format
        person2_fra_date: Person 2's FRA date (optional, calculated if not provided)
        person2_birth_date: Person 2's birth date in YYYY-MM-DD format (used if person2_fra_date is None)
    
    Returns:
        Person 2's monthly spousal benefit amount
    """
    # Calculate Person 2's FRA date if needed
    if person2_fra_date is None and person2_birth_date:
        person2_fra_date = fra_to_date(person2_birth_date)
    
    if person2_fra_date is None:
        # Can't calculate spousal benefit without Person 2's FRA, return 0
        return 0.0
    
    try:
        person2_ret_date = datetime.strptime(person2_retirement_date, "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return 0.0
    
    # Calculate months between Person 2's retirement and Person 2's own FRA
    months_diff = (person2_ret_date.year - person2_fra_date.year) * 12 + (person2_ret_date.month - person2_fra_date.month)
    
    # Spousal benefit percentage depends on when Person 2 claims relative to Person 2's own FRA
    # Base amount is 50% of Person 1's PIA
    if months_diff < 0:
        # Person 2 claims before their own FRA
        months_early = abs(months_diff)
        
        # Reduction calculation:
        # First 36 months: 25/36 of 1% per month
        # After 36 months: 5/12 of 1% per month
        if months_early <= 36:
            reduction = months_early * (25/36) * 0.01
        else:
            # First 36 months
            reduction = 36 * (25/36) * 0.01
            # Additional months after 36
            reduction += (months_early - 36) * (5/12) * 0.01
        
        # Maximum reduction is to 32.5% (50% - 17.5%)
        reduction = min(reduction, 0.175)
        spousal_percentage = 0.50 - reduction
    else:
        # Person 2 claims at or after their own FRA
        spousal_percentage = 0.50
    
    spousal_benefit = person1_pia * spousal_percentage
    
    return round(spousal_benefit, 2)
