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
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { calculateYearFraction } from '../utils/dateUtils';
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

type CashFlowItem = Record<string, any>;
type AssetItem = Record<string, any>;

interface CashFlowSummaryProps {
  incomeItems?: CashFlowItem[];
  expenseItems?: CashFlowItem[];
  assets?: AssetItem[];
}

export default function CashFlowSummary({ incomeItems = [], expenseItems = [], assets = [] }: CashFlowSummaryProps) {
  const { userSettings } = useAuth(); // Get userSettings from context
  const [years, setYears] = useState(10);
  const [defaultInflation, setDefaultInflation] = useState(2.0);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await SettingsService.getSettings();
        setDefaultInflation(res.data.default_inflation_percent);
      } catch (e: any) {
      }
    };
    loadSettings();
  }, []);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  const currentYear = new Date().getFullYear();

  // Pre-calculate asset projections for all years (needed for dynamic items)
  const assetProjections: Record<string, number[]> = {};
  assets.forEach((asset: AssetItem) => {
    assetProjections[asset.name] = [];
    for (let i = 0; i < years; i++) {
      const projectionYear = currentYear + i;
      const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
      if (yearFraction > 0) {
        const growthRate = (asset.annual_increase_percent || 0) / 100;
        const assetValue = asset.value * Math.pow(1 + growthRate, i);
        assetProjections[asset.name].push(assetValue);
      } else {
        // Asset is not active in this year
        assetProjections[asset.name].push(0);
      }
    }
  });

  // Calculate year-by-year projections
  const yearlyData: Array<{ year: number; income: number; expenses: number; surplus: number }> = [];
  for (let i = 0; i < years; i++) {
    const year = currentYear + i;
    
    // Calculate income for this year
    const yearIncome = incomeItems.reduce((sum: number, item: CashFlowItem) => {
      // Check if item is active in this year and calculate proration
      const yearFraction = calculateYearFraction(item.start_date, item.end_date, year);
      if (yearFraction <= 0) {
        // Item is not active in this year, skip it
        return sum;
      }
      
      let itemValue = item.yearly_value || 0;
      
      // Handle dynamic items (linked to assets) - check both linked_item_id and linked_asset_ids
      const isDynamicAssetLinked = item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined;
      if (isDynamicAssetLinked) {
        // Get linked asset IDs - check linked_asset_ids first, then linked_item_id
        let linkedAssetIds: Array<number | string> = [];
        if (item.linked_asset_ids && Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0) {
          linkedAssetIds = item.linked_asset_ids;
        } else if (item.linked_item_id) {
          linkedAssetIds = [item.linked_item_id];
        }
        
        // Calculate dividend from linked assets (by name for CashFlowSummary)
        if (linkedAssetIds.length > 0) {
          let totalAssetValue = 0;
          linkedAssetIds.forEach((assetId: number | string) => {
            const linkedAsset = assets.find((a: any) => a.id === assetId);
            if (linkedAsset && assetProjections[linkedAsset.name] && assetProjections[linkedAsset.name][i] !== undefined) {
              totalAssetValue += assetProjections[linkedAsset.name][i];
            }
          });
          itemValue = totalAssetValue * (item.percentage / 100.0);
        } else {
          // Fallback: if no linked assets found, treat as fixed
          const increaseRate = (item.annual_increase_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + increaseRate, i);
        }
      } else {
        // Fixed value item - apply growth rate
        const increaseRate = (item.annual_increase_percent || 0) / 100;
        itemValue = item.yearly_value * Math.pow(1 + increaseRate, i);
      }
      
      // Apply year fraction to prorate for one-time items and partial years
      itemValue = itemValue * yearFraction;
      
      return sum + itemValue;
    }, 0);

    // Calculate expenses for this year
    const yearExpenses = expenseItems.reduce((sum: number, item: CashFlowItem) => {
      // Check if item is active in this year and calculate proration
      const yearFraction = calculateYearFraction(item.start_date, item.end_date, year);
      if (yearFraction <= 0) {
        // Item is not active in this year, skip it
        return sum;
      }
      
      let itemValue = item.yearly_value;
      
      // Handle dynamic items (linked to assets)
      if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
        // Find the linked asset
        const linkedAsset = assets.find((a: any) => a.id === item.linked_item_id);
        if (linkedAsset && assetProjections[linkedAsset.name] && assetProjections[linkedAsset.name][i] !== undefined) {
          // Recalculate based on projected asset value for this year
          const projectedAssetValue = assetProjections[linkedAsset.name][i];
          itemValue = projectedAssetValue * (item.percentage / 100.0);
        }
      } else {
        // Fixed value item - apply inflation rate
        const inflationRate = (item.inflation_percent || defaultInflation) / 100;
        itemValue = item.yearly_value * Math.pow(1 + inflationRate, i);
      }
      
      // Apply year fraction to prorate for one-time items and partial years
      itemValue = itemValue * yearFraction;
      
      return sum + itemValue;
    }, 0);

    const surplus = yearIncome - yearExpenses;

    yearlyData.push({
      year,
      income: yearIncome,
      expenses: yearExpenses,
      surplus,
    });
  }

  const totalIncome = incomeItems.reduce((sum: number, item: CashFlowItem) => sum + (item.yearly_value || 0), 0);
  const totalExpenses = expenseItems.reduce((sum: number, item: CashFlowItem) => sum + (item.yearly_value || 0), 0);
  const currentSurplus = totalIncome - totalExpenses;

  // Chart data
  const chartData = {
    labels: yearlyData.map((d: any) => d.year),
    datasets: [
      {
        label: 'Income',
        data: yearlyData.map((d: any) => d.income),
        borderColor: '#2e7d32',
        backgroundColor: 'rgba(46, 125, 50, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Expenses',
        data: yearlyData.map((d: any) => d.expenses),
        borderColor: '#c62828',
        backgroundColor: 'rgba(198, 40, 40, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Surplus/Deficit',
        data: yearlyData.map((d: any) => d.surplus),
        borderColor: '#1565c0',
        backgroundColor: 'rgba(21, 101, 192, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions: any = {
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
        text: `Model My Retirement - Cash Flow Projection${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
        font: { size: 13 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 10 },
          callback: (value: number | string) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
              notation: 'compact',
            }).format(Number(value) || 0),
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
            onChange={(e: any) => setYears(parseInt(e.target.value) || 10)}
          />
          years
        </label>
      </div>

      <div className="chart-container">
        <Line data={chartData as any} options={chartOptions as any} />
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
          {yearlyData.map((data: any) => (
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
