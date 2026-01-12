/**
 * Calculate the fraction of a year an item is active based on start_date and end_date.
 * Returns a value between 0 and 1 representing the fraction of the year.
 * 
 * @param {string|null} startDate - Start date in YYYY-MM-DD format or null
 * @param {string|null} endDate - End date in YYYY-MM-DD format or null
 * @param {number} projectionYear - The year to check (e.g., 2027)
 * @returns {number} Fraction of the year (0 to 1), e.g., 0.5833 for 7 months
 */
export function calculateYearFraction(startDate, endDate, projectionYear) {
  const yearStart = new Date(projectionYear, 0, 1); // January 1 of the year
  const yearEnd = new Date(projectionYear, 11, 31); // December 31 of the year
  
  let itemStart = yearStart; // Default to start of year if no start_date
  let itemEnd = yearEnd; // Default to end of year if no end_date
  
  if (startDate) {
    const start = new Date(startDate);
    // If item starts during the year, use that date; otherwise use year start
    itemStart = start > yearStart ? start : yearStart;
  }
  
  if (endDate) {
    const end = new Date(endDate);
    // If item ends during the year, use that date; otherwise use year end
    itemEnd = end < yearEnd ? end : yearEnd;
  }
  
  // If item ends before year starts or starts after year ends, return 0
  if (itemEnd < yearStart || itemStart > yearEnd) {
    return 0;
  }
  
  // Calculate the number of months the item is active in this year
  // We'll calculate based on days and convert to months for simplicity
  const daysInYear = 365; // Approximation (could use 365.25 for leap years)
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  
  // Calculate the overlap period
  const overlapStart = itemStart > yearStart ? itemStart : yearStart;
  const overlapEnd = itemEnd < yearEnd ? itemEnd : yearEnd;
  
  // Calculate days in overlap (add 1 to include both start and end days)
  const overlapDays = Math.floor((overlapEnd - overlapStart) / millisecondsPerDay) + 1;
  
  // Calculate fraction (days / days in year)
  // But we need to account for the actual number of days in the specific year
  const daysInThisYear = new Date(projectionYear, 11, 31).getTime() - new Date(projectionYear, 0, 1).getTime();
  const daysInThisYearCount = Math.floor(daysInThisYear / millisecondsPerDay) + 1;
  
  const fraction = overlapDays / daysInThisYearCount;
  
  return Math.max(0, Math.min(1, fraction)); // Clamp between 0 and 1
}
