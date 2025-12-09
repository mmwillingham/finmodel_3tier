import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import SettingsService from '../services/settings.service';
import './CashFlowSummary.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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

  // Chart data
  const chartData = {
    labels: yearlyData.map(d => d.year),
    datasets: [
      {
        label: 'Income',
        data: yearlyData.map(d => d.income),
        borderColor: '#2e7d32',
        backgroundColor: 'rgba(46, 125, 50, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Expenses',
        data: yearlyData.map(d => d.expenses),
        borderColor: '#c62828',
        backgroundColor: 'rgba(198, 40, 40, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Surplus/Deficit',
        data: yearlyData.map(d => d.surplus),
        borderColor: '#1565c0',
        backgroundColor: 'rgba(21, 101, 192, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 11 },
          boxWidth: 12,
          padding: 10,
        },
      },
      title: {
        display: true,
        text: 'Cash Flow Projection',
        font: { size: 13 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 10 },
          callback: (value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
              notation: 'compact',
            }).format(value),
        },
      },
      x: {
        ticks: {
          font: { size: 10 },
        },
      },
    },
  };

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

      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
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