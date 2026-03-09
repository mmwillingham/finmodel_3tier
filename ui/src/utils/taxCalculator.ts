/**
 * Federal Tax Calculator (JavaScript version)
 * 
 * Calculates federal income tax based on:
 * - Filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household)
 * - Age (65+ gets higher standard deduction)
 * - Taxable income (income minus deductions)
 * - Tax-deductible expenses
 * 
 * Uses 2025 federal tax brackets and standard deductions.
 */

// 2025 Federal Tax Brackets (Single)
const TAX_BRACKETS_SINGLE = [
  [0, 0.10],          // 10% up to $11,925
  [11925, 0.12],      // 12% from $11,925 to $48,475
  [48475, 0.22],      // 22% from $48,475 to $103,350
  [103350, 0.24],     // 24% from $103,350 to $197,300
  [197300, 0.32],     // 32% from $197,300 to $250,525
  [250525, 0.35],     // 35% from $250,525 to $626,350
  [626350, 0.37],     // 37% above $626,350
];

// 2025 Federal Tax Brackets (Married Filing Jointly)
const TAX_BRACKETS_MARRIED_JOINTLY = [
  [0, 0.10],          // 10% up to $23,850
  [23850, 0.12],      // 12% from $23,850 to $96,950
  [96950, 0.22],      // 22% from $96,950 to $206,700
  [206700, 0.24],     // 24% from $206,700 to $394,600
  [394600, 0.32],     // 32% from $394,600 to $501,050
  [501050, 0.35],     // 35% from $501,050 to $752,700
  [752700, 0.37],     // 37% above $752,700
];

// 2025 Federal Tax Brackets (Married Filing Separately)
const TAX_BRACKETS_MARRIED_SEPARATELY = [
  [0, 0.10],          // 10% up to $11,925
  [11925, 0.12],      // 12% from $11,925 to $48,475
  [48475, 0.22],      // 22% from $48,475 to $103,350
  [103350, 0.24],     // 24% from $103,350 to $197,300
  [197300, 0.32],     // 32% from $197,300 to $250,525
  [250525, 0.35],     // 35% from $250,525 to $376,350
  [376350, 0.37],     // 37% above $376,350
];

// 2025 Federal Tax Brackets (Head of Household)
const TAX_BRACKETS_HEAD_OF_HOUSEHOLD = [
  [0, 0.10],          // 10% up to $17,000
  [17000, 0.12],      // 12% from $17,000 to $64,700
  [64700, 0.22],      // 22% from $64,700 to $103,350
  [103350, 0.24],     // 24% from $103,350 to $197,300
  [197300, 0.32],     // 32% from $197,300 to $250,525
  [250525, 0.35],     // 35% from $250,525 to $626,350
  [626350, 0.37],     // 37% above $626,350
];

// 2025 Standard Deductions
const STANDARD_DEDUCTION_SINGLE = 14950;
const STANDARD_DEDUCTION_MARRIED_JOINTLY = 29900;
const STANDARD_DEDUCTION_MARRIED_SEPARATELY = 14950;
const STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD = 22400;

// Additional standard deduction for age 65+ (2025)
const ADDITIONAL_DEDUCTION_65_PLUS = 1900; // Per person 65 or older

export function getTaxBrackets(filingStatus: any) {
  const statusMap: any = {
    "Single": TAX_BRACKETS_SINGLE,
    "Married Filing Jointly": TAX_BRACKETS_MARRIED_JOINTLY,
    "Married Filing Separately": TAX_BRACKETS_MARRIED_SEPARATELY,
    "Head of Household": TAX_BRACKETS_HEAD_OF_HOUSEHOLD,
    "Qualifying Surviving Spouse": TAX_BRACKETS_MARRIED_JOINTLY, // Uses same brackets as Married Filing Jointly
  };
  return statusMap[filingStatus] || TAX_BRACKETS_SINGLE;
}

export function getStandardDeduction(filingStatus: any, person1Age = 0, person2Age = 0) {
  const baseDeductions: any = {
    "Single": STANDARD_DEDUCTION_SINGLE,
    "Married Filing Jointly": STANDARD_DEDUCTION_MARRIED_JOINTLY,
    "Married Filing Separately": STANDARD_DEDUCTION_MARRIED_SEPARATELY,
    "Head of Household": STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD,
    "Qualifying Surviving Spouse": STANDARD_DEDUCTION_MARRIED_JOINTLY, // Uses same deduction as Married Filing Jointly
  };
  
  const base = baseDeductions[filingStatus] || STANDARD_DEDUCTION_SINGLE;
  
  // Add age-based deductions
  let additional = 0;
  if (filingStatus === "Married Filing Jointly" || filingStatus === "Qualifying Surviving Spouse") {
    if (person1Age >= 65) additional += ADDITIONAL_DEDUCTION_65_PLUS;
    if (person2Age >= 65) additional += ADDITIONAL_DEDUCTION_65_PLUS;
  } else if (["Single", "Married Filing Separately", "Head of Household"].includes(filingStatus)) {
    if (person1Age >= 65) additional += ADDITIONAL_DEDUCTION_65_PLUS;
  }
  
  return base + additional;
}

export function calculateAgeFromBirthdate(birthdate: any, currentYear: any = null) {
  if (!birthdate) return 0;
  
  try {
    const birthYear = parseInt(birthdate.split('-')[0]);
    if (currentYear === null) {
      currentYear = new Date().getFullYear();
    }
    return currentYear - birthYear;
  } catch (e: any) {
    return 0;
  }
}

export function calculateTax(
  taxableIncome: any,
  filingStatus: any,
  person1Birthdate: any = null,
  person2Birthdate: any = null,
  currentYear: any = null
) {
  if (taxableIncome <= 0) return 0.0;
  
  if (currentYear === null) {
    currentYear = new Date().getFullYear();
  }
  
  // Calculate ages
  const person1Age = calculateAgeFromBirthdate(person1Birthdate, currentYear);
  const person2Age = person2Birthdate ? calculateAgeFromBirthdate(person2Birthdate, currentYear) : 0;
  
  // Get standard deduction
  const standardDeduction = getStandardDeduction(filingStatus, person1Age, person2Age);
  
  // Taxable income for calculation (should be after standard deduction)
  const incomeToTax = Math.max(0, taxableIncome);
  
  // Get appropriate tax brackets
  const brackets = getTaxBrackets(filingStatus);
  
  // Calculate tax using progressive brackets
  let tax = 0.0;
  let previousBracket = 0;
  
  for (let i = 0; i < brackets.length; i++) {
    const [bracketThreshold, rate] = brackets[i];
    if (incomeToTax > previousBracket) {
      // Calculate amount in this bracket
      let amountInBracket;
      if (i < brackets.length - 1) {
        // Not the last bracket
        const nextThreshold = brackets[i + 1][0];
        amountInBracket = Math.min(incomeToTax, nextThreshold) - previousBracket;
      } else {
        // Last bracket (top bracket)
        amountInBracket = incomeToTax - previousBracket;
      }
      
      if (amountInBracket > 0) {
        tax += amountInBracket * rate;
        previousBracket = i < brackets.length - 1 ? brackets[i + 1][0] : incomeToTax;
      }
    } else {
      break;
    }
  }
  
  return Math.round(tax * 100) / 100; // Round to 2 decimal places
}

export function calculateTaxableIncome(
  totalIncome: any,
  taxDeductibleExpenses = 0.0,
  filingStatus = "Single",
  person1Birthdate: any = null,
  person2Birthdate: any = null,
  currentYear: any = null
) {
  if (currentYear === null) {
    currentYear = new Date().getFullYear();
  }
  
  // Calculate ages
  const person1Age = calculateAgeFromBirthdate(person1Birthdate, currentYear);
  const person2Age = person2Birthdate ? calculateAgeFromBirthdate(person2Birthdate, currentYear) : 0;
  
  // Get standard deduction
  const standardDeduction = getStandardDeduction(filingStatus, person1Age, person2Age);
  
  // Calculate Adjusted Gross Income (AGI) = total income - tax deductible expenses
  const agi = Math.max(0, totalIncome - taxDeductibleExpenses);
  
  // Taxable income = AGI - standard deduction
  const taxableIncome = Math.max(0, agi - standardDeduction);
  
  // Calculate tax
  const taxOwed = calculateTax(taxableIncome, filingStatus, person1Birthdate, person2Birthdate, currentYear);
  
  return {
    taxableIncome,
    standardDeduction,
    taxOwed,
    agi
  };
}
