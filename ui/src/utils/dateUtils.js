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
  // Normalize dates to UTC to avoid timezone issues
  // Create year boundaries at midnight UTC
  const yearStart = new Date(Date.UTC(projectionYear, 0, 1)); // January 1 of the year
  const yearEnd = new Date(Date.UTC(projectionYear, 11, 31, 23, 59, 59, 999)); // December 31 of the year (end of day)
  
  let itemStart = yearStart; // Default to start of year if no start_date
  let itemEnd = yearEnd; // Default to end of year if no end_date
  
  if (startDate) {
    // Parse date string and normalize to UTC midnight
    const start = new Date(startDate + 'T00:00:00Z');
    // If item starts during the year, use that date; otherwise use year start
    itemStart = start > yearStart ? start : yearStart;
  }
  
  if (endDate) {
    // Parse date string and normalize to UTC end of day
    const end = new Date(endDate + 'T23:59:59.999Z');
    // If item ends during the year, use that date; otherwise use year end
    itemEnd = end < yearEnd ? end : yearEnd;
  }
  
  // If item ends before year starts or starts after year ends, return 0
  if (itemEnd < yearStart || itemStart > yearEnd) {
    return 0;
  }
  
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  
  // Calculate the overlap period
  const overlapStart = itemStart > yearStart ? itemStart : yearStart;
  const overlapEnd = itemEnd < yearEnd ? itemEnd : yearEnd;
  
  // Calculate days in overlap (add 1 to include both start and end days)
  const overlapDays = Math.floor((overlapEnd - overlapStart) / millisecondsPerDay) + 1;
  
  // Calculate fraction (days / days in year)
  // Account for the actual number of days in the specific year
  const daysInThisYear = new Date(Date.UTC(projectionYear, 11, 31)).getTime() - new Date(Date.UTC(projectionYear, 0, 1)).getTime();
  const daysInThisYearCount = Math.floor(daysInThisYear / millisecondsPerDay) + 1;
  
  const fraction = overlapDays / daysInThisYearCount;
  
  return Math.max(0, Math.min(1, fraction)); // Clamp between 0 and 1
}
