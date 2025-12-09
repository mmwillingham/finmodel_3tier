import React from 'react';
import './ProjectionsTable.css';

export default function ProjectionsTable({ projections, onViewProjection }) {
  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value ?? 0);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="projections-table-container">
      <table className="projections-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Plan Name</th>
            <th>Years</th>
            <th>Final Value</th>
            <th>Total Contributed</th>
            <th>Total Growth</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((proj) => (
            <tr key={proj.id}>
              <td>
                <button
                  onClick={() => onViewProjection(proj.id)}
                  className="view-btn"
                >
                  View
                </button>
              </td>
              <td>{proj.name}</td>
              <td>{proj.years}</td>
              <td>{formatCurrency(proj.final_value)}</td>
              <td>{formatCurrency(proj.total_contributed)}</td>
              <td>{formatCurrency(proj.total_growth)}</td>
              <td>{formatDate(proj.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}