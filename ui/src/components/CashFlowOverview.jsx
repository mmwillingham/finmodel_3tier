import React from "react";
import { Line } from "react-chartjs-2";

export default function CashFlowOverview({ incomeItems, expenseItems, projectionYears, formatCurrency }) {
  const currentYear = new Date().getFullYear(); // Get current year

  const calculateCashFlowProjection = () => {
    const years = [];
    const incomeValues = [];
    const expenseValues = [];
    const surplus = [];

    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      
      let totalIncome = 0;
      incomeItems.forEach((item) => {
        const growthRate = item.annual_increase_percent / 100;
        totalIncome += item.yearly_value * Math.pow(1 + growthRate, year);
      });

      let totalExpenses = 0;
      expenseItems.forEach((item) => {
        const inflationRate = item.inflation_percent / 100;
        totalExpenses += item.yearly_value * Math.pow(1 + inflationRate, year);
      });

      incomeValues.push(totalIncome);
      expenseValues.push(totalExpenses);
      surplus.push(totalIncome - totalExpenses);
    }

    return { years, incomeValues, expenseValues, surplus };
  };

  const cashFlowProjection = calculateCashFlowProjection();

  const cashFlowChartData = {
    labels: cashFlowProjection.years.map(year => currentYear + year), // Adjust labels to current year
    datasets: [
      {
        label: "Income",
        data: cashFlowProjection.incomeValues,
        borderColor: "rgb(75, 192, 75)",
        backgroundColor: "rgba(75, 192, 75, 0.2)",
      },
      {
        label: "Expenses",
        data: cashFlowProjection.expenseValues,
        borderColor: "rgb(255, 99, 99)",
        backgroundColor: "rgba(255, 99, 99, 0.2)",
      },
      {
        label: "Surplus",
        data: cashFlowProjection.surplus,
        borderColor: "rgb(153, 102, 255)",
        backgroundColor: "rgba(153, 102, 255, 0.2)",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Show every 5th year in tables
  const displayYears = cashFlowProjection.years.filter((y) => y % 5 === 0);

  return (
    <div className="cashflow-overview-container">
      <h3>Income & Expense Projection</h3>
      <div style={{ marginBottom: "30px" }}>
        <Line data={cashFlowChartData} options={chartOptions} />
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Income</th>
            <th>Expenses</th>
            <th>Surplus</th>
          </tr>
        </thead>
        <tbody>
          {displayYears.map((year) => (
            <tr key={year}>
              <td>{currentYear + year}</td> {/* Adjust table year to current year */}
              <td>{formatCurrency(cashFlowProjection.incomeValues[year])}</td>
              <td>{formatCurrency(cashFlowProjection.expenseValues[year])}</td>
              <td>{formatCurrency(cashFlowProjection.surplus[year])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
