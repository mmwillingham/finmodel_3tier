import React from 'react';
import './CashFlowView.css'; // reuse table styles

export default function CashFlowSummary({ incomeItems, expenseItems }) {
  const incomeTotal = incomeItems.reduce((s, i) => s + i.yearlyValue, 0);
  const expenseTotal = expenseItems.reduce((s, i) => s + i.yearlyValue, 0);
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
            <td>${incomeTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Total Expenses</td>
            <td>${expenseTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Surplus / Deficit</td>
            <td>${surplus.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}