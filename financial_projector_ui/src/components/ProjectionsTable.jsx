import React from 'react';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount ?? 0);

export default function ProjectionsTable({ projections = [] }) {
  const navigate = useNavigate();

  // Extract account names from first projection's data_json (if available)
  let accountHeaders = [];
  if (projections.length > 0 && projections[0].data_json) {
    try {
      const yearlyData = JSON.parse(projections[0].data_json);
      if (Array.isArray(yearlyData) && yearlyData.length > 0) {
        const firstYear = yearlyData[0];
        Object.keys(firstYear).forEach(key => {
          if (key.endsWith('_Value') && key !== 'Total_Value') {
            accountHeaders.push(key.replace('_Value', ''));
          }
        });
      }
    } catch (e) {
      accountHeaders = [];
    }
  }

  return (
    <table className="projections-table">
      <thead>
        <tr>
          <th>Plan Name</th>
          <th>Years</th>
          {accountHeaders.map(accName => (
            <th key={accName}>{accName}</th>
          ))}
          <th>Total Contributed</th>
          <th>Final Value</th>
          <th>Date Saved</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {projections.map(proj => {
          let year1AccountValues = {};
          if (proj.data_json) {
            try {
              const yearlyData = JSON.parse(proj.data_json);
              if (Array.isArray(yearlyData) && yearlyData.length > 0) {
                const firstYear = yearlyData[0];
                accountHeaders.forEach(accName => {
                  year1AccountValues[accName] = Number(firstYear[`${accName}_Value`] ?? 0);
                });
              }
            } catch (e) {
              // ignore
            }
          }

          return (
            <tr key={proj.id}>
              <td>{proj.name}</td>
              <td>{proj.years}</td>
              {accountHeaders.map(accName => (
                <td key={accName}>
                  {formatCurrency(year1AccountValues[accName] ?? 0)}
                </td>
              ))}
              <td>{formatCurrency(proj.total_contributed)}</td>
              <td>{formatCurrency(proj.final_value)}</td>
              <td>{proj.timestamp ? new Date(proj.timestamp).toLocaleString() : 'N/A'}</td>
              <td>
                <button 
                  onClick={() => navigate(`/projection/${proj.id}`)}
                  className="view-btn"
                >
                  View
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}