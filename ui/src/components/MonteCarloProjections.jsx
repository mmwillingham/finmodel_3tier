import React, { useState, useRef } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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
      
      // Pre-calculate base projections
      const baseAssetProjections = {};
      assets.forEach(asset => {
        baseAssetProjections[asset.name] = [];
        for (let i = 0; i <= projectionYears; i++) {
          const growthRate = (asset.annual_increase_percent || 0) / 100;
          const assetValue = asset.value * Math.pow(1 + growthRate, i);
          baseAssetProjections[asset.name].push(assetValue);
        }
      });

      for (let sim = 0; sim < numSimulations; sim++) {
        const yearlyData = [];
        
        for (let year = 0; year <= projectionYears; year++) {
          // Calculate income with random variation
          let totalIncome = 0;
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
            
            totalIncome += itemValue;
          });

          // Calculate expenses with random variation
          let totalExpenses = 0;
          expenseItems.forEach(item => {
            let itemValue = item.yearly_value;
            
            if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null) {
              const linkedAsset = assets.find(a => a.id === item.linked_item_id);
              if (linkedAsset && baseAssetProjections[linkedAsset.name]) {
                const baseValue = baseAssetProjections[linkedAsset.name][year];
                const variation = (Math.random() * volatility * 2 - volatility) / 100;
                const variedValue = baseValue * (1 + variation);
                itemValue = variedValue * (item.percentage / 100.0);
              }
            } else {
              // Add random variation to fixed expenses
              const variation = (Math.random() * volatility * 2 - volatility) / 100;
              const inflationRate = (item.inflation_percent || 2.0) / 100;
              itemValue = item.yearly_value * Math.pow(1 + inflationRate, year) * (1 + variation);
            }
            
            totalExpenses += itemValue;
          });

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
            const growthRate = (liability.annual_increase_percent || 0) / 100;
            const liabilityValue = liability.value * Math.pow(1 + growthRate, year);
            totalLiabilities += liabilityValue;
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

  const chartData = results ? {
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
        text: `Monte Carlo Cash Flow Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
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
          <div style={{ height: '400px', marginBottom: '30px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>

          <h3>Statistical Summary</h3>
          <div style={{ overflowX: 'auto' }}>
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

