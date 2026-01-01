import React, { useState, useEffect } from "react";
import ProjectionService from "../services/projection.service";
import ProjectionChart from "./ProjectionChart"; // Import the ProjectionChart
import "./ProjectionDetail.css";

export default function ProjectionDetail({ projectionId }) {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjection = async () => {
      try {
        setLoading(true);
        const data = await ProjectionService.getProjectionDetails(projectionId);
        setProjection(data);
      } catch (error) {
        console.error("Error fetching projection details:", error);
        setProjection(null);
      } finally {
        setLoading(false);
      }
    };

    if (projectionId) {
      fetchProjection();
    }
  }, [projectionId]);

  if (loading) {
    return <div>Loading projection details...</div>;
  }

  if (!projection || !projection.time_series_data) {
    return <div>Projection not found or no data available.</div>;
  }

  // Group time_series_data by year for table display
  const yearlyDataMap = new Map();
  projection.time_series_data.forEach(item => {
    if (!yearlyDataMap.has(item.year)) {
      yearlyDataMap.set(item.year, { Year: item.year });
    }
    const yearData = yearlyDataMap.get(item.year);
    // Use value_type to create dynamic keys for the table
    // For account-specific data, we might want to prefix with account name
    let key = item.value_type.replace(/_/g, " ");
    if (item.account && item.account.name) {
        // If there's an account and it's not a global total (account_id is null for totals)
        // Add account-specific data like balances, contributions, growth if needed
        // For now, let's just focus on global totals and net worth in the main table.
        // We can add a separate section for individual account details later.
        if (item.value_type === "account_balance") {
            key = `${item.account.name} Balance`;
        } else if (item.value_type === "contribution_flow") {
            key = `${item.account.name} Contribution`;
        } else if (item.value_type === "growth_value") {
            key = `${item.account.name} Growth`;
        }
    }
    yearData[key] = item.value;
  });

  const yearlyData = Array.from(yearlyDataMap.values()).sort((a, b) => a.Year - b.Year);

  // Determine all unique column headers from all years' data
  const allHeaders = new Set();
  yearlyData.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key !== "Year") { // 'Year' is always first
        allHeaders.add(key);
      }
    });
  });
  const sortedHeaders = ["Net Worth", "Total Assets", "Total Liabilities", "Total Income Flow", "Total Expense Flow", "Net Cash Flow", "Total Contribution", "Total Growth"].filter(h => allHeaders.has(h));
  // Add any other dynamic account headers that might have been picked up, ensuring 'Year' is first.
  const finalHeaders = ["Year", ...sortedHeaders, ...Array.from(allHeaders).filter(h => !sortedHeaders.includes(h))];

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value ?? 0);

  const formatCell = (key, value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      // Check for specific keys that represent percentages or rates if any will be shown
      // For now, assume all numbers in the table are currency values
      return formatCurrency(value);
    }
    return value;
  };

  return (
    <div className="projection-detail">
      <h2>{projection.name}</h2>

      <div className="projection-summary">
        <div className="summary-item">
          <strong>Years:</strong> {projection.years}
        </div>
        <div className="summary-item">
          <strong>Final Value (Net Worth):</strong> {formatCurrency(projection.final_value)}
        </div>
        <div className="summary-item">
          <strong>Total Contributed:</strong> {formatCurrency(projection.total_contributed)}
        </div>
        <div className="summary-item">
          <strong>Total Growth:</strong> {formatCurrency(projection.total_growth)}
        </div>
      </div>

      <ProjectionChart projection={projection} /> {/* Render the chart here */}

      <h3>Year-by-Year Breakdown</h3>
      <div className="table-container">
        <table className="yearly-table">
          <thead>
            <tr>
              {finalHeaders.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yearlyData.map((row, idx) => (
              <tr key={idx}>
                {finalHeaders.map((header, i) => (
                  <td key={i}>{formatCell(header, row[header])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Optionally display initial projected accounts */}
      {projection.accounts_data && projection.accounts_data.length > 0 && (
        <>
          <h3>Initial Accounts for Projection</h3>
          <div className="table-container">
            <table className="yearly-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Initial Value</th>
                  <th>Annual Contribution</th>
                  <th>Annual Growth Rate</th>
                </tr>
              </thead>
              <tbody>
                {projection.accounts_data.map((account, idx) => (
                  <tr key={idx}>
                    <td>{account.name}</td>
                    <td>{account.account_type}</td>
                    <td>{formatCurrency(account.initial_value)}</td>
                    <td>{formatCurrency(account.contribution * 12)}</td> {/* Display annual contribution */}
                    <td>{account.growth_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
