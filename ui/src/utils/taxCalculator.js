/**
 * Federal Tax Calculator (JavaScript version)
 * 
 * Calculates federal income tax based on:
 * - Filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household)
 * - Age (65+ gets higher standard deduction)
 * - Taxable income (income minus deductions)
 * - Tax-deductible expenses
 * 
 * Uses 2024 federal tax brackets and standard deductions.
 */

// 2024 Federal Tax Brackets (Single)
const TAX_BRACKETS_SINGLE = [
  [0, 0.10],          // 10% up to $11,600
  [11600, 0.12],      // 12% from $11,600 to $47,150
  [47150, 0.22],      // 22% from $47,150 to $100,525
  [100525, 0.24],     // 24% from $100,525 to $191,950
  [191950, 0.32],     // 32% from $191,950 to $243,725
  [243725, 0.35],     // 35% from $243,725 to $609,350
  [609350, 0.37],     // 37% above $609,350
];

// 2024 Federal Tax Brackets (Married Filing Jointly)
const TAX_BRACKETS_MARRIED_JOINTLY = [
  [0, 0.10],          // 10% up to $23,200
  [23200, 0.12],      // 12% from $23,200 to $94,300
  [94300, 0.22],      // 22% from $94,300 to $201,050
  [201050, 0.24],     // 24% from $201,050 to $383,900
  [383900, 0.32],     // 32% from $383,900 to $487,450
  [487450, 0.35],     // 35% from $487,450 to $731,200
  [731200, 0.37],     // 37% above $731,200
];

// 2024 Federal Tax Brackets (Married Filing Separately)
const TAX_BRACKETS_MARRIED_SEPARATELY = [
  [0, 0.10],          // 10% up to $11,600
  [11600, 0.12],      // 12% from $11,600 to $47,150
  [47150, 0.22],      // 22% from $47,150 to $100,525
  [100525, 0.24],     // 24% from $100,525 to $191,950
  [191950, 0.32],     // 32% from $191,950 to $243,725
  [243725, 0.35],     // 35% from $243,725 to $365,600
  [365600, 0.37],     // 37% above $365,600
];

// 2024 Federal Tax Brackets (Head of Household)
const TAX_BRACKETS_HEAD_OF_HOUSEHOLD = [
  [0, 0.10],          // 10% up to $16,550
  [16550, 0.12],      // 12% from $16,550 to $63,100
  [63100, 0.22],      // 22% from $63,100 to $100,500
  [100500, 0.24],     // 24% from $100,500 to $191,950
  [191950, 0.32],     // 32% from $191,950 to $243,700
  [243700, 0.35],     // 35% from $243,700 to $609,350
  [609350, 0.37],     // 37% above $609,350
];

// 2024 Standard Deductions
const STANDARD_DEDUCTION_SINGLE = 14600;
const STANDARD_DEDUCTION_MARRIED_JOINTLY = 29200;
const STANDARD_DEDUCTION_MARRIED_SEPARATELY = 14600;
const STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD = 21900;

// Additional standard deduction for age 65+ (2024)
const ADDITIONAL_DEDUCTION_65_PLUS = 1850; // Per person 65 or older

export function getTaxBrackets(filingStatus) {
  const statusMap = {
    "Single": TAX_BRACKETS_SINGLE,
    "Married Filing Jointly": TAX_BRACKETS_MARRIED_JOINTLY,
    "Married Filing Separately": TAX_BRACKETS_MARRIED_SEPARATELY,
    "Head of Household": TAX_BRACKETS_HEAD_OF_HOUSEHOLD,
  };
  return statusMap[filingStatus] || TAX_BRACKETS_SINGLE;
}

export function getStandardDeduction(filingStatus, person1Age = 0, person2Age = 0) {
  const baseDeductions = {
    "Single": STANDARD_DEDUCTION_SINGLE,
    "Married Filing Jointly": STANDARD_DEDUCTION_MARRIED_JOINTLY,
    "Married Filing Separately": STANDARD_DEDUCTION_MARRIED_SEPARATELY,
    "Head of Household": STANDARD_DEDUCTION_HEAD_OF_HOUSEHOLD,
  };
  
  const base = baseDeductions[filingStatus] || STANDARD_DEDUCTION_SINGLE;
  
  // Add age-based deductions
  let additional = 0;
  if (filingStatus === "Married Filing Jointly") {
    if (person1Age >= 65) additional += ADDITIONAL_DEDUCTION_65_PLUS;
    if (person2Age >= 65) additional += ADDITIONAL_DEDUCTION_65_PLUS;
  } else if (["Single", "Married Filing Separately", "Head of Household"].includes(filingStatus)) {
    if (person1Age >= 65) additional += ADDITIONAL_DEDUCTION_65_PLUS;
  }
  
  return base + additional;
}

export function calculateAgeFromBirthdate(birthdate, currentYear = null) {
  if (!birthdate) return 0;
  
  try {
    const birthYear = parseInt(birthdate.split('-')[0]);
    if (currentYear === null) {
      currentYear = new Date().getFullYear();
    }
    return currentYear - birthYear;
  } catch (e) {
    return 0;
  }
}

export function calculateTax(taxableIncome, filingStatus, person1Birthdate = null, person2Birthdate = null, currentYear = null) {
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
  totalIncome,
  taxDeductibleExpenses = 0.0,
  filingStatus = "Single",
  person1Birthdate = null,
  person2Birthdate = null,
  currentYear = null
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
