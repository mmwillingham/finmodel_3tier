import React from 'react';
import './ProjectionsTable.css';

export default function ProjectionsTable({ projections, onViewProjection, onEdit, onDelete }) {
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
        <colgroup>
          <col style={{ width: '180px' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="actions">Actions</th>
            <th>Plan Name</th>
            <th className="numeric">Years</th>
            <th className="numeric">Final Value</th>
            <th className="numeric">Total Contributed</th>
            <th className="numeric">Total Growth</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((proj) => (
            <tr key={proj.id}>
              <td className="actions">
                <div className="action-buttons">
                  <button onClick={() => onViewProjection(proj.id)} className="view-btn">View</button>
                  <button onClick={() => onEdit(proj)} className="edit-btn">Edit</button>
                  <button onClick={() => onDelete(proj.id)} className="delete-btn">Delete</button>
                </div>
              </td>
              <td>{proj.name}</td>
              <td className="numeric">{proj.years}</td>
              <td className="numeric">{formatCurrency(proj.final_value)}</td>
              <td className="numeric">{formatCurrency(proj.total_contributed)}</td>
              <td className="numeric">{formatCurrency(proj.total_growth)}</td>
              <td>{formatDate(proj.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}