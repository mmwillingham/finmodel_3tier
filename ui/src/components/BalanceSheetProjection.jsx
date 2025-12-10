import React from "react";
import { Line } from "react-chartjs-2";

export default function BalanceSheetProjection({ assets, liabilities, projectionYears, formatCurrency, showChartTotals }) {
  const currentYear = new Date().getFullYear(); // Get current year

  const calculateProjections = () => {
    const years = [];
    const totalAssetValues = [];
    const totalLiabilityValues = [];
    const netWorthValues = [];
    
    const individualAssetProjections = assets.map(asset => ({ 
        ...asset, 
        projectedValues: [] 
    }));
    const individualLiabilityProjections = liabilities.map(liability => ({
        ...liability,
        projectedValues: []
    }));

    for (let yearIndex = 0; yearIndex <= projectionYears; yearIndex++) {
      const currentProjectionYear = currentYear + yearIndex;
      years.push(currentProjectionYear); 
      
      let yearTotalAssets = 0;
      individualAssetProjections.forEach((asset) => {
        const assetStartDate = asset.start_date ? new Date(asset.start_date) : null;
        const assetEndDate = asset.end_date ? new Date(asset.end_date) : null;

        let assetValue = 0;
        const isActive = 
          (!assetStartDate || currentProjectionYear >= assetStartDate.getFullYear()) &&
          (!assetEndDate || currentProjectionYear <= assetEndDate.getFullYear());

        if (isActive) {
          const growthRate = asset.annual_increase_percent / 100;
          assetValue = asset.value * Math.pow(1 + growthRate, yearIndex);
        }
        yearTotalAssets += assetValue;
        asset.projectedValues.push(assetValue);
      });

      let yearTotalLiabilities = 0;
      individualLiabilityProjections.forEach((liability) => {
        const liabilityStartDate = liability.start_date ? new Date(liability.start_date) : null;
        const liabilityEndDate = liability.end_date ? new Date(liability.end_date) : null;

        let liabilityValue = 0;
        const isActive = 
          (!liabilityStartDate || currentProjectionYear >= liabilityStartDate.getFullYear()) &&
          (!liabilityEndDate || currentProjectionYear <= liabilityEndDate.getFullYear());

        if (isActive) {
          const growthRate = liability.annual_increase_percent / 100;
          liabilityValue = liability.value * Math.pow(1 + growthRate, yearIndex);
        }
        yearTotalLiabilities += liabilityValue;
        liability.projectedValues.push(liabilityValue);
      });

      totalAssetValues.push(yearTotalAssets);
      totalLiabilityValues.push(yearTotalLiabilities);
      netWorthValues.push(yearTotalAssets - yearTotalLiabilities);
    }

    return { 
      years, 
      totalAssetValues, 
      totalLiabilityValues, 
      netWorthValues, 
      individualAssetProjections, 
      individualLiabilityProjections 
    };
  };

  const { 
    years, 
    totalAssetValues, 
    totalLiabilityValues, 
    netWorthValues, 
    individualAssetProjections, 
    individualLiabilityProjections 
  } = calculateProjections();

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
  const displayYearsIndices = years.map((_, index) => index).filter((y) => y % 5 === 0);

  return (
    <div className="balance-sheet-projection-container">
      <h2>Balance Sheet Projections</h2>
      
      {/* Combined Assets, Liabilities, Net Worth Chart and Table */}
      <h3>Overall Financial Snapshot</h3>
      <div style={{ marginBottom: "30px" }}>
        <Line 
          data={{
            labels: years,
            datasets: [
              {
                label: "Total Assets",
                data: totalAssetValues,
                borderColor: "rgb(75, 192, 192)",
                backgroundColor: "rgba(75, 192, 192, 0.2)",
              },
              {
                label: "Total Liabilities",
                data: totalLiabilityValues,
                borderColor: "rgb(255, 99, 132)",
                backgroundColor: "rgba(255, 99, 132, 0.2)",
              },
              {
                label: "Net Worth",
                data: netWorthValues,
                borderColor: "rgb(54, 162, 235)",
                backgroundColor: "rgba(54, 162, 235, 0.2)",
              },
            ],
          }}
          options={chartOptions}
        />
      </div>

      <table className="cashflow-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Total Assets</th>
            <th>Total Liabilities</th>
            <th>Net Worth</th>
          </tr>
        </thead>
        <tbody>
          {displayYearsIndices.map((index) => (
            <tr key={years[index]}>
              <td>{years[index]}</td>
              <td>{formatCurrency(totalAssetValues[index])}</td>
              <td>{formatCurrency(totalLiabilityValues[index])}</td>
              <td>{formatCurrency(netWorthValues[index])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Individual Asset Projections Chart */}
      <h3 style={{ marginTop: "50px" }}>Individual Asset Projections</h3>
      <div style={{ marginBottom: "30px" }}>
        <Line 
          data={{
            labels: years,
            datasets: [
              ...individualAssetProjections.map((asset, index) => ({
                label: asset.name,
                data: asset.projectedValues,
                borderColor: `hsl(${index * 60}, 70%, 50%)`, // Dynamic color
                backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.2)`,
                fill: false,
              })),
              ...(showChartTotals ? [{
                label: "Total Assets",
                data: totalAssetValues,
                borderColor: "rgb(0, 0, 0)", // Black color for total
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                fill: false,
                borderWidth: 3,
                pointRadius: 0,
              }] : []),
            ],
          }}
          options={chartOptions}
        />
      </div>

      {/* Individual Asset Projections Table */}
      <table className="cashflow-table" style={{ marginBottom: "50px" }}>
        <thead>
          <tr>
            <th>Asset Name</th>
            {displayYearsIndices.map((index) => (
              <th key={years[index]}>{years[index]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {individualAssetProjections.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.name}</td>
              {displayYearsIndices.map((index) => (
                <td key={years[index]}>{formatCurrency(asset.projectedValues[index])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Individual Liability Projections Chart */}
      {liabilities.length > 0 && (
        <h3 style={{ marginTop: "50px" }}>Individual Liability Projections</h3>
      )}
      {liabilities.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <Line 
            data={{
              labels: years,
              datasets: individualLiabilityProjections.map((liability, index) => ({
                label: liability.name,
                data: liability.projectedValues,
                borderColor: `hsl(${index * 60 + 30}, 70%, 50%)`, // Dynamic color, offset from assets
                backgroundColor: `hsla(${index * 60 + 30}, 70%, 50%, 0.2)`,
                fill: false,
              })),
            }}
            options={chartOptions}
          />
        </div>
      )}

      {/* Individual Liability Projections Table */}
      {liabilities.length > 0 && (
        <table className="cashflow-table">
          <thead>
            <tr>
              <th>Liability Name</th>
              {displayYearsIndices.map((index) => (
                <th key={years[index]}>{years[index]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {individualLiabilityProjections.map((liability) => (
              <tr key={liability.id}>
                <td>{liability.name}</td>
                {displayYearsIndices.map((index) => (
                  <td key={years[index]}>{formatCurrency(liability.projectedValues[index])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
