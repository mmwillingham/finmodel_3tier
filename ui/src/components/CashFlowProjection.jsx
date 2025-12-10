import React, { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import AssetService from "../services/asset.service";
import LiabilityService from "../services/liability.service";
import CashFlowService from "../services/cashflow.service";
import SettingsService from "../services/settings.service";
import "./CashFlowView.css";

export default function CashFlowProjection() {
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);
  const [expenseItems, setExpenseItems] = useState([]);
  const [projectionYears, setProjectionYears] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [astRes, libRes, incRes, expRes, settingsRes] = await Promise.all([
          AssetService.list(),
          LiabilityService.list(),
          CashFlowService.list(true),
          CashFlowService.list(false),
          SettingsService.getSettings(),
        ]);
        setAssets(astRes.data || []);
        setLiabilities(libRes.data || []);
        setIncomeItems(incRes.data || []);
        setExpenseItems(expRes.data || []);
        setProjectionYears(settingsRes.data.projection_years || 30);
      } catch (e) {
        console.error("Failed to load cash flow projection data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  // Calculate asset values over time
  const calculateAssetProjection = () => {
    const years = [];
    const assetValues = [];
    const liabilityValues = [];
    const netWorth = [];

    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      
      let totalAssets = 0;
      assets.forEach((asset) => {
        const growthRate = asset.annual_increase_percent / 100;
        totalAssets += asset.value * Math.pow(1 + growthRate, year);
      });

      let totalLiabilities = 0;
      liabilities.forEach((liability) => {
        const growthRate = liability.annual_increase_percent / 100;
        totalLiabilities += liability.value * Math.pow(1 + growthRate, year);
      });

      assetValues.push(totalAssets);
      liabilityValues.push(totalLiabilities);
      netWorth.push(totalAssets - totalLiabilities);
    }

    return { years, assetValues, liabilityValues, netWorth };
  };

  // Calculate income/expense projection over time
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

  if (loading) return <div>Loading...</div>;

  const assetProjection = calculateAssetProjection();
  const cashFlowProjection = calculateCashFlowProjection();

  const assetChartData = {
    labels: assetProjection.years,
    datasets: [
      {
        label: "Assets",
        data: assetProjection.assetValues,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
      },
      {
        label: "Liabilities",
        data: assetProjection.liabilityValues,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
      },
      {
        label: "Net Worth",
        data: assetProjection.netWorth,
        borderColor: "rgb(54, 162, 235)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
      },
    ],
  };

  const cashFlowChartData = {
    labels: cashFlowProjection.years,
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
  const displayYears = assetProjection.years.filter((y) => y % 5 === 0);

  return (
    <div className="cashflow-container">
      <h2>Cash Flow Projections</h2>

      <h3>Balance Sheet Projection</h3>
      <div style={{ marginBottom: "30px" }}>
        <Line data={assetChartData} options={chartOptions} />
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Assets</th>
            <th>Liabilities</th>
            <th>Net Worth</th>
          </tr>
        </thead>
        <tbody>
          {displayYears.map((year) => (
            <tr key={year}>
              <td>{year}</td>
              <td>{formatCurrency(assetProjection.assetValues[year])}</td>
              <td>{formatCurrency(assetProjection.liabilityValues[year])}</td>
              <td>{formatCurrency(assetProjection.netWorth[year])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: "50px" }}>Income & Expense Projection</h3>
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
              <td>{year}</td>
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
