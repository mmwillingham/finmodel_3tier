/**
 * Social Security Benefit Calculator (Frontend)
 * 
 * Calculates Social Security benefits based on:
 * - Full Retirement Age (FRA) based on birth year
 * - Primary Insurance Amount (PIA)
 * - Retirement date (early, on-time, or delayed)
 * - COLA adjustments
 */

export function calculateFRA(birthYear) {
  /**
   * Calculate Full Retirement Age (FRA) based on birth year.
   * Returns an object with years and months.
   */
  if (birthYear >= 1960) {
    return { years: 67, months: 0 };
  } else if (birthYear === 1959) {
    return { years: 66, months: 10 };
  } else if (birthYear === 1958) {
    return { years: 66, months: 8 };
  } else if (birthYear === 1957) {
    return { years: 66, months: 6 };
  } else if (birthYear === 1956) {
    return { years: 66, months: 4 };
  } else if (birthYear === 1955) {
    return { years: 66, months: 2 };
  } else if (birthYear >= 1943 && birthYear <= 1954) {
    return { years: 66, months: 0 };
  } else {
    // For years before 1943, FRA is 65
    return { years: 65, months: 0 };
  }
}

export function calculateFRADate(birthDate) {
  /**
   * Calculate the Full Retirement Age date from birth date.
   * Returns date string in YYYY-MM-DD format or null if invalid.
   */
  if (!birthDate) return null;
  
  try {
    const birth = new Date(birthDate + 'T00:00:00'); // Add time to avoid timezone issues
    const birthYear = birth.getFullYear();
    const fra = calculateFRA(birthYear);
    
    // Calculate FRA date
    const fraDate = new Date(birth);
    fraDate.setFullYear(birth.getFullYear() + fra.years);
    fraDate.setMonth(birth.getMonth() + fra.months);
    
    // Format as YYYY-MM-DD
    const year = fraDate.getFullYear();
    const month = String(fraDate.getMonth() + 1).padStart(2, '0');
    const day = String(fraDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return null;
  }
}

export function formatFRADisplay(birthDate) {
  /**
   * Format FRA for display (e.g., "66 years, 2 months" or "67 years")
   */
  if (!birthDate) return '';
  
  try {
    const birth = new Date(birthDate + 'T00:00:00');
    const birthYear = birth.getFullYear();
    const fra = calculateFRA(birthYear);
    
    if (fra.months === 0) {
      return `${fra.years} years`;
    } else {
      return `${fra.years} years, ${fra.months} months`;
    }
  } catch (e) {
    return '';
  }
}

export function calculateMonthlyBenefit(pia, retirementDate, fraDate, birthDate) {
  /**
   * Calculate Social Security monthly benefit based on PIA, retirement date, and FRA.
   * This is a simplified version - the backend will do the full calculation.
   */
  if (!pia || pia <= 0 || !retirementDate || !fraDate) {
    return pia || 0;
  }
  
  try {
    const retDate = new Date(retirementDate + 'T00:00:00');
    const fra = new Date(fraDate + 'T00:00:00');
    
    // Calculate months difference
    const monthsDiff = (retDate.getFullYear() - fra.getFullYear()) * 12 + 
                       (retDate.getMonth() - fra.getMonth());
    
    if (monthsDiff < 0) {
      // Early retirement
      const monthsEarly = Math.abs(monthsDiff);
      
      let reduction = 0;
      if (monthsEarly <= 36) {
        reduction = monthsEarly * (5/9) * 0.01;
      } else {
        reduction = 36 * (5/9) * 0.01 + (monthsEarly - 36) * (5/12) * 0.01;
      }
      
      return Math.round(pia * (1 - reduction) * 100) / 100;
    } else if (monthsDiff > 0) {
      // Delayed retirement
      // Calculate age at retirement
      let ageAtRetirement = retDate.getFullYear() - fra.getFullYear() + (calculateFRA(new Date(birthDate + 'T00:00:00').getFullYear()).years);
      
      if (!birthDate) {
        ageAtRetirement = 70; // Default
      } else {
        const birth = new Date(birthDate + 'T00:00:00');
        ageAtRetirement = retDate.getFullYear() - birth.getFullYear() - 
          ((retDate.getMonth() < birth.getMonth()) || 
           (retDate.getMonth() === birth.getMonth() && retDate.getDate() < birth.getDate()) ? 1 : 0);
      }
      
      // Delay credits: 2/3 of 1% per month up to age 70
      const monthsDelay = ageAtRetirement >= 70 ? 
        Math.min(monthsDiff, 36) : // Approximate max 36 months
        monthsDiff;
      
      const increase = monthsDelay * (2/3) * 0.01;
      return Math.round(pia * (1 + increase) * 100) / 100;
    } else {
      // Exactly at FRA
      return pia;
    }
  } catch (e) {
    return pia || 0;
  }
}

export function getMinRetirementDate(birthDate) {
  /**
   * Get minimum retirement date (62nd birthday) for validation.
   * Returns date string in YYYY-MM-DD format or null.
   */
  if (!birthDate) return null;
  
  try {
    const birth = new Date(birthDate + 'T00:00:00');
    const minDate = new Date(birth);
    minDate.setFullYear(birth.getFullYear() + 62);
    
    const year = minDate.getFullYear();
    const month = String(minDate.getMonth() + 1).padStart(2, '0');
    const day = String(minDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return null;
  }
}
