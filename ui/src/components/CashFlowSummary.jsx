import React from 'react';
import './CashFlowView.css';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value ?? 0);

export default function CashFlowSummary({ incomeItems, expenseItems }) {
  const incomeTotal = (incomeItems || []).reduce((s, i) => s + (parseFloat(i.yearly_value) || 0), 0);
  const expenseTotal = (expenseItems || []).reduce((s, i) => s + (parseFloat(i.yearly_value) || 0), 0);
  const surplus = incomeTotal - expenseTotal;

  return (
    <div className="cashflow-container">
      <h2>Yearly Surplus / Deficit</h2>
      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Yearly Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Income</td>
            <td>{formatCurrency(incomeTotal)}</td>
          </tr>
          <tr>
            <td>Total Expenses</td>
            <td>{formatCurrency(expenseTotal)}</td>
          </tr>
          <tr>
            <td>Surplus / Deficit</td>
            <td>{formatCurrency(surplus)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}