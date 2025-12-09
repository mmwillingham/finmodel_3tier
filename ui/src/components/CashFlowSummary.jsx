import React, { useState, useEffect } from 'react';
import SettingsService from '../services/settings.service';
import './CashFlowSummary.css';

export default function CashFlowSummary({ incomeItems, expenseItems }) {
  const [years, setYears] = useState(10);
  const [defaultInflation, setDefaultInflation] = useState(2.0);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        setDefaultInflation(res.data.default_inflation_percent);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    };
    loadSettings();
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const currentYear = new Date().getFullYear();

  // Calculate year-by-year projections
  const yearlyData = [];
  for (let i = 0; i < years; i++) {
    const year = currentYear + i;
    
    // Calculate income for this year
    const yearIncome = incomeItems.reduce((sum, item) => {
      const increaseRate = (item.annual_increase_percent || 0) / 100;
      const adjustedValue = item.yearly_value * Math.pow(1 + increaseRate, i);
      return sum + adjustedValue;
    }, 0);

    // Calculate expenses for this year
    const yearExpenses = expenseItems.reduce((sum, item) => {
      const inflationRate = (item.inflation_percent || defaultInflation) / 100;
      const adjustedValue = item.yearly_value * Math.pow(1 + inflationRate, i);
      return sum + adjustedValue;
    }, 0);

    const surplus = yearIncome - yearExpenses;

    yearlyData.push({
      year,
      income: yearIncome,
      expenses: yearExpenses,
      surplus,
    });
  }

  const totalIncome = incomeItems.reduce((sum, item) => sum + (item.yearly_value || 0), 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + (item.yearly_value || 0), 0);
  const currentSurplus = totalIncome - totalExpenses;

  return (
    <div className="cashflow-summary">
      <h2>Cash Flow Summary</h2>

      <div className="summary-cards">
        <div className="summary-card income-card">
          <h3>Total Income (Current Year)</h3>
          <p className="amount">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="summary-card expense-card">
          <h3>Total Expenses (Current Year)</h3>
          <p className="amount">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className={`summary-card ${currentSurplus >= 0 ? 'surplus-card' : 'deficit-card'}`}>
          <h3>{currentSurplus >= 0 ? 'Surplus' : 'Deficit'} (Current Year)</h3>
          <p className="amount">{formatCurrency(Math.abs(currentSurplus))}</p>
        </div>
      </div>

      <div className="projection-controls">
        <label>
          Project for 
          <input
            type="number"
            min="1"
            max="50"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value) || 10)}
          />
          years
        </label>
      </div>

      <h3>Year-by-Year Projection</h3>
      <table className="yearly-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Income</th>
            <th>Expenses</th>
            <th>Surplus/Deficit</th>
          </tr>
        </thead>
        <tbody>
          {yearlyData.map((data) => (
            <tr key={data.year} className={data.surplus >= 0 ? 'surplus-row' : 'deficit-row'}>
              <td>{data.year}</td>
              <td>{formatCurrency(data.income)}</td>
              <td>{formatCurrency(data.expenses)}</td>
              <td className={data.surplus >= 0 ? 'positive' : 'negative'}>
                {formatCurrency(data.surplus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}