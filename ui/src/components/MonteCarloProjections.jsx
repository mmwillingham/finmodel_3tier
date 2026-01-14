import React, { useState, useRef } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { calculateTaxableIncome } from '../utils/taxCalculator';
import { calculateYearFraction } from '../utils/dateUtils';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Constant to identify the federal tax expense item (must match backend)
const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";

export default function MonteCarloProjections({ incomeItems, expenseItems, assets, liabilities, projectionYears, formatCurrency }) {
  const { userSettings } = useAuth();
  const currentYear = new Date().getFullYear();
  const chartRef = useRef(null);
  const tableRef = useRef(null);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [volatility, setVolatility] = useState(15); // Standard deviation for growth rates as percentage
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runMonteCarloSimulation = () => {
    setLoading(true);
    setResults(null);

    // Run simulations in batches to avoid blocking UI
    setTimeout(() => {
      const simulationResults = [];
      
      for (let sim = 0; sim < numSimulations; sim++) {
        const yearlyData = [];
        
        // Pre-calculate base projections for THIS simulation (each simulation needs its own copy)
        const baseAssetProjections = {};
        assets.forEach(asset => {
          baseAssetProjections[asset.name] = [];
          for (let i = 0; i <= projectionYears; i++) {
            const projectionYear = currentYear + i;
            // Check if asset is active for this year (respects end_date)
            const yearFraction = calculateYearFraction(asset.start_date, asset.end_date, projectionYear);
            if (yearFraction > 0) {
              const growthRate = (asset.annual_increase_percent || 0) / 100;
              const assetValue = asset.value * Math.pow(1 + growthRate, i);
              baseAssetProjections[asset.name].push(assetValue);
            } else {
              // Asset has ended, set value to 0
              baseAssetProjections[asset.name].push(0);
            }
          }
        });
        
        // Track reinvested dividends by asset for this simulation
        const reinvestedDividendsByAsset = {};
        
        for (let year = 0; year <= projectionYears; year++) {
          // Calculate income with random variation
          let totalIncome = 0;
          let totalTaxableIncome = 0; // Track taxable income for tax calculations
          
          incomeItems.forEach(item => {
            let itemValue = item.yearly_value;
            
            if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null) {
              const linkedAsset = assets.find(a => a.id === item.linked_item_id);
              if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                // Add random variation to asset value, then calculate percentage
                const baseValue = baseAssetProjections[linkedAsset.name][year];
                const variation = (Math.random() * volatility * 2 - volatility) / 100; // -volatility to +volatility %
                const variedValue = baseValue * (1 + variation);
                itemValue = variedValue * (item.percentage / 100.0);
              }
            } else {
              // Add random variation to fixed income
              const variation = (Math.random() * volatility * 2 - volatility) / 100;
              const increaseRate = (item.annual_increase_percent || 0) / 100;
              itemValue = item.yearly_value * Math.pow(1 + increaseRate, year) * (1 + variation);
            }
            
            // Count as taxable income if taxable
            if (item.taxable) {
              totalTaxableIncome += itemValue;
            }
            
            // Check if this is a reinvested dividend - exclude from cash flow
            const isDividend = (item.category?.toLowerCase().includes('dividend') || item.description?.toLowerCase().includes('dividend'));
            const shouldReinvest = isDividend && item.reinvest_dividends;
            
            // If reinvested, don't add to totalIncome (cash flow) but track for asset addition
            if (shouldReinvest) {
              // Determine which asset to add to
              let targetAssetId = item.reinvestment_account_id;
              if (!targetAssetId && item.linked_item_id && item.linked_item_type === "asset") {
                // Default to source asset if no reinvestment account specified
                targetAssetId = item.linked_item_id;
              }
              
              if (targetAssetId) {
                const targetAsset = assets.find(a => a.id === targetAssetId);
                if (targetAsset && baseAssetProjections[targetAsset.name]) {
                  // Add to asset projection for future years (will compound with growth)
                  const assetKey = targetAsset.name;
                  if (!reinvestedDividendsByAsset[assetKey]) {
                    reinvestedDividendsByAsset[assetKey] = {};
                  }
                  if (!reinvestedDividendsByAsset[assetKey][year]) {
                    reinvestedDividendsByAsset[assetKey][year] = 0;
                  }
                  reinvestedDividendsByAsset[assetKey][year] += itemValue;
                  // Update base projections for future years in this simulation
                  for (let futureYear = year; futureYear <= projectionYears; futureYear++) {
                    const growthRate = targetAsset.annual_increase_percent || 0;
                    if (baseAssetProjections[assetKey][futureYear] !== undefined) {
                      baseAssetProjections[assetKey][futureYear] += itemValue * Math.pow(1 + growthRate / 100, futureYear - year);
                    }
                  }
                }
              }
              // Don't add to totalIncome - dividends are reinvested, not received as cash
            } else {
              // Not reinvested - add to income (cash flow)
              totalIncome += itemValue;
            }
          });

          // Calculate expenses with random variation
          let totalExpenses = 0;
          let totalTaxDeductibleExpenses = 0; // Track tax-deductible expenses for tax calculation
          const federalTaxExpenseItem = expenseItems.find(item => item.description === FEDERAL_TAX_EXPENSE_DESCRIPTION);
          const regularExpenseItems = expenseItems.filter(item => item.description !== FEDERAL_TAX_EXPENSE_DESCRIPTION);
          
          // Process regular expenses first (excluding federal tax expense)
          regularExpenseItems.forEach(item => {
            // Check if item is active in this year
            const startYear = item.start_date ? new Date(item.start_date).getFullYear() : currentYear;
            const endYear = item.end_date ? new Date(item.end_date).getFullYear() : currentYear + projectionYears;
            const currentProjectionYear = currentYear + year;
            
            if (currentProjectionYear < startYear || currentProjectionYear > endYear) {
              // Item is not active in this year, skip it
              return;
            }

            let itemValue = item.yearly_value;
            
            if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null) {
              const linkedAsset = assets.find(a => a.id === item.linked_item_id);
              if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                const baseValue = baseAssetProjections[linkedAsset.name][year];
                const variation = (Math.random() * volatility * 2 - volatility) / 100;
                const variedValue = baseValue * (1 + variation);
                itemValue = variedValue * (item.percentage / 100.0);
              }
            } else if (item.linked_item_id && item.linked_item_type === "income" && item.percentage !== null) {
              // Expense linked to income - calculate based on linked income value
              const linkedIncomeItem = incomeItems.find(i => i.id === item.linked_item_id);
              if (linkedIncomeItem) {
                // Calculate the linked income value for this year
                let linkedIncomeValue = linkedIncomeItem.yearly_value || 0;
                
                // Check if linked income is also dynamic (linked to asset)
                if (linkedIncomeItem.linked_item_id && linkedIncomeItem.linked_item_type === "asset" && linkedIncomeItem.percentage !== null) {
                  const linkedAsset = assets.find(a => a.id === linkedIncomeItem.linked_item_id);
                  if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                    const baseValue = baseAssetProjections[linkedAsset.name][year];
                    const variation = (Math.random() * volatility * 2 - volatility) / 100;
                    const variedValue = baseValue * (1 + variation);
                    linkedIncomeValue = variedValue * (linkedIncomeItem.percentage / 100.0);
                  }
                } else {
                  // Fixed income - apply growth rate with variation
                  const variation = (Math.random() * volatility * 2 - volatility) / 100;
                  const increaseRate = (linkedIncomeItem.annual_increase_percent || 0) / 100;
                  linkedIncomeValue = linkedIncomeItem.yearly_value * Math.pow(1 + increaseRate, year) * (1 + variation);
                }
                
                // Calculate expense as percentage of linked income
                itemValue = linkedIncomeValue * (item.percentage / 100.0);
              } else {
                // Linked income item not found - use fixed value with inflation and variation
                const variation = (Math.random() * volatility * 2 - volatility) / 100;
                const inflationRate = (item.inflation_percent || 2.0) / 100;
                itemValue = item.yearly_value * Math.pow(1 + inflationRate, year) * (1 + variation);
              }
            } else {
              // Add random variation to fixed expenses
              const variation = (Math.random() * volatility * 2 - volatility) / 100;
              const inflationRate = (item.inflation_percent || 2.0) / 100;
              itemValue = item.yearly_value * Math.pow(1 + inflationRate, year) * (1 + variation);
            }
            
            // Count tax-deductible expenses for tax calculation
            if (item.tax_deductible) {
              totalTaxDeductibleExpenses += itemValue;
            }
            
            totalExpenses += itemValue;
          });
        
          // Calculate federal taxes if the expense item exists
          let federalTax = 0;
          if (federalTaxExpenseItem && userSettings) {
            const currentProjectionYear = currentYear + year;
            const startYear = federalTaxExpenseItem.start_date ? new Date(federalTaxExpenseItem.start_date).getFullYear() : currentYear;
            const endYear = federalTaxExpenseItem.end_date ? new Date(federalTaxExpenseItem.end_date).getFullYear() : currentYear + projectionYears;
            
            if (currentProjectionYear >= startYear && currentProjectionYear <= endYear) {
              try {
                const taxResult = calculateTaxableIncome(
                  totalTaxableIncome,
                  totalTaxDeductibleExpenses,
                  userSettings.tax_filing_status || "Single",
                  userSettings.person1_birthdate,
                  userSettings.person2_birthdate,
                  currentProjectionYear
                );
                federalTax = taxResult.taxOwed || 0;
                // Add taxes to total expenses
                totalExpenses += federalTax;
              } catch (error) {
                console.error('Error calculating taxes in Monte Carlo:', error);
              }
            }
          }

          // Calculate net cash flow
          const netCashFlow = totalIncome - totalExpenses;
          
          // Calculate net worth (simplified - sum of assets minus liabilities)
          let totalAssets = 0;
          assets.forEach(asset => {
            const baseValue = baseAssetProjections[asset.name][year];
            const variation = (Math.random() * volatility * 2 - volatility) / 100;
            totalAssets += baseValue * (1 + variation);
          });

          let totalLiabilities = 0;
          liabilities.forEach(liability => {
            const projectionYear = currentYear + year;
            // Check if liability is active for this year (respects end_date)
            const yearFraction = calculateYearFraction(liability.start_date, liability.end_date, projectionYear);
            if (yearFraction > 0) {
              const growthRate = (liability.annual_increase_percent || 0) / 100;
              const liabilityValue = liability.value * Math.pow(1 + growthRate, year);
              totalLiabilities += liabilityValue;
            }
            // If liability has ended (yearFraction === 0), don't add to total (value is 0)
          });

          const netWorth = totalAssets - totalLiabilities;

          yearlyData.push({
            year: currentYear + year,
            income: totalIncome,
            expenses: totalExpenses,
            netCashFlow: netCashFlow,
            netWorth: netWorth
          });
        }

        simulationResults.push(yearlyData);
      }

      // Calculate statistics across all simulations
      const statistics = [];
      for (let year = 0; year <= projectionYears; year++) {
        const yearData = {
          year: currentYear + year,
          netCashFlow: {
            values: simulationResults.map(sim => sim[year].netCashFlow).sort((a, b) => a - b),
          },
          netWorth: {
            values: simulationResults.map(sim => sim[year].netWorth).sort((a, b) => a - b),
          }
        };

        const getPercentile = (sortedArray, percentile) => {
          const index = Math.floor(sortedArray.length * percentile / 100);
          return sortedArray[index] || 0;
        };

        yearData.netCashFlow.p10 = getPercentile(yearData.netCashFlow.values, 10);
        yearData.netCashFlow.p25 = getPercentile(yearData.netCashFlow.values, 25);
        yearData.netCashFlow.p50 = getPercentile(yearData.netCashFlow.values, 50); // Median
        yearData.netCashFlow.p75 = getPercentile(yearData.netCashFlow.values, 75);
        yearData.netCashFlow.p90 = getPercentile(yearData.netCashFlow.values, 90);
        yearData.netCashFlow.mean = yearData.netCashFlow.values.reduce((a, b) => a + b, 0) / yearData.netCashFlow.values.length;

        yearData.netWorth.p10 = getPercentile(yearData.netWorth.values, 10);
        yearData.netWorth.p25 = getPercentile(yearData.netWorth.values, 25);
        yearData.netWorth.p50 = getPercentile(yearData.netWorth.values, 50);
        yearData.netWorth.p75 = getPercentile(yearData.netWorth.values, 75);
        yearData.netWorth.p90 = getPercentile(yearData.netWorth.values, 90);
        yearData.netWorth.mean = yearData.netWorth.values.reduce((a, b) => a + b, 0) / yearData.netWorth.values.length;

        statistics.push(yearData);
      }

      setResults(statistics);
      setLoading(false);
    }, 100);
  };

  const exportToPDF = async () => {
    if (!chartRef.current || !results) return;

    try {
      const canvas = await html2canvas(chartRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('landscape', 'pt', [canvas.width, canvas.height]);
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`monte-carlo-projection-${currentYear}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    }
  };

  const netWorthChartData = results ? {
    labels: results.map(d => d.year),
    datasets: [
      {
        label: '10th Percentile',
        data: results.map(d => d.netWorth.p10),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: '25th Percentile',
        data: results.map(d => d.netWorth.p25),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: 'Median (50th)',
        data: results.map(d => d.netWorth.p50),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
      },
      {
        label: 'Mean',
        data: results.map(d => d.netWorth.mean),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderDash: [2, 2],
        fill: false,
      },
      {
        label: '75th Percentile',
        data: results.map(d => d.netWorth.p75),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: '90th Percentile',
        data: results.map(d => d.netWorth.p90),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  } : null;

  const netCashFlowChartData = results ? {
    labels: results.map(d => d.year),
    datasets: [
      {
        label: '10th Percentile',
        data: results.map(d => d.netCashFlow.p10),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
      {
        label: '25th Percentile',
        data: results.map(d => d.netCashFlow.p25),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: 'Median (50th)',
        data: results.map(d => d.netCashFlow.p50),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
      },
      {
        label: 'Mean',
        data: results.map(d => d.netCashFlow.mean),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderDash: [2, 2],
        fill: false,
      },
      {
        label: '75th Percentile',
        data: results.map(d => d.netCashFlow.p75),
        borderColor: 'rgba(255, 159, 64, 0.5)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderDash: [3, 3],
        fill: false,
      },
      {
        label: '90th Percentile',
        data: results.map(d => d.netCashFlow.p90),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderDash: [5, 5],
        fill: false,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Monte Carlo Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) => formatCurrency(value),
        },
      },
    },
  };

  return (
    <div className="monte-carlo-projections" style={{ padding: '20px' }}>
      <h2>Monte Carlo Projections</h2>
      <p>Run probabilistic simulations to see the range of possible financial outcomes.</p>

      <div className="controls" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label htmlFor="num-simulations">Number of Simulations: </label>
            <input
              id="num-simulations"
              type="number"
              min="100"
              max="10000"
              step="100"
              value={numSimulations}
              onChange={(e) => setNumSimulations(parseInt(e.target.value) || 1000)}
              style={{ width: '100px', padding: '5px' }}
            />
          </div>
          <div>
            <label htmlFor="volatility">Volatility (%): </label>
            <input
              id="volatility"
              type="number"
              min="0"
              max="50"
              step="1"
              value={volatility}
              onChange={(e) => setVolatility(parseFloat(e.target.value) || 15)}
              style={{ width: '100px', padding: '5px' }}
            />
            <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
              Standard deviation for random variations in growth rates
            </small>
          </div>
          <button
            onClick={runMonteCarloSimulation}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0b57d0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {loading ? 'Running Simulations...' : 'Run Monte Carlo Simulation'}
          </button>
          {results && (
            <button
              onClick={exportToPDF}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Export to PDF
            </button>
          )}
        </div>
      </div>

      {results && (
        <div ref={chartRef}>
          {/* Net Worth Chart */}
          <h3>Net Worth Projections</h3>
          <div style={{ height: '400px', marginBottom: '40px' }}>
            <Line data={netWorthChartData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  ...chartOptions.plugins.title,
                  text: `Monte Carlo Net Worth Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
                },
              },
            }} />
          </div>

          {/* Net Worth Table */}
          <h3>Statistical Summary - Net Worth</h3>
          <div style={{ overflowX: 'auto', marginBottom: '40px' }}>
            <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Year</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>10th %ile</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>25th %ile</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Median</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Mean</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>75th %ile</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>90th %ile</th>
                </tr>
              </thead>
              <tbody>
                {results.map((stat, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{stat.year}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netWorth.p10)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netWorth.p25)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatCurrency(stat.netWorth.p50)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netWorth.mean)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netWorth.p75)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netWorth.p90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Net Cash Flow Chart */}
          <h3>Net Cash Flow Projections</h3>
          <div style={{ height: '400px', marginBottom: '40px' }}>
            <Line data={netCashFlowChartData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  ...chartOptions.plugins.title,
                  text: `Monte Carlo Net Cash Flow Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
                },
              },
            }} />
          </div>

          {/* Net Cash Flow Table */}
          <h3>Statistical Summary - Net Cash Flow</h3>
          <div style={{ overflowX: 'auto', marginBottom: '40px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Year</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>10th %ile</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>25th %ile</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Median</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Mean</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>75th %ile</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>90th %ile</th>
                </tr>
              </thead>
              <tbody>
                {results.map((stat, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{stat.year}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netCashFlow.p10)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netCashFlow.p25)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatCurrency(stat.netCashFlow.p50)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netCashFlow.mean)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netCashFlow.p75)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>{formatCurrency(stat.netCashFlow.p90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

