import React, { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line } from "react-chartjs-2";
import ProjectionService from '../services/projection.service';

export default function BalanceSheetProjection({ assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, showChartTotals }) {
  const { userSettings } = useAuth();
  const currentYear = new Date().getFullYear();
  const overallChartRef = useRef(null);
  const overallTableRef = useRef(null);
  const individualAssetChartRef = useRef(null);
  const individualAssetTableRef = useRef(null);
  const individualLiabilityChartRef = useRef(null);
  const individualLiabilityTableRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [projectionData, setProjectionData] = useState(null);
  const [error, setError] = useState(null);

  // Convert assets and liabilities to ProjectedAccountCreate format and call backend
  const fetchProjectionData = useCallback(async () => {
    if (!assets || !liabilities) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert assets to ProjectedAccountCreate format
      // Note: Expenses that contribute to assets are now handled by the backend
      // We no longer need to pre-calculate contributions here for fixed expenses
      // The backend will query for expenses that contribute to assets and add them after calculating expense flows
      const assetAccounts = assets.map(asset => {
        return {
          name: asset.name,
          account_type: 'asset',
          initial_value: asset.value || 0,
          contribution: 0.0, // Contributions from expenses are now handled by backend
          growth_rate: asset.annual_increase_percent || 0,
          loan_type: null,
          principal_amount: null,
          interest_rate: null,
          loan_term_months: null,
          loan_start_date: null,
          monthly_payment: null
        };
      });

      // Convert liabilities to ProjectedAccountCreate format
      const liabilityAccounts = liabilities.map(liability => ({
        name: liability.name,
        account_type: 'liability',
        initial_value: -(Math.abs(liability.value || 0)), // Negative for liabilities
        contribution: 0.0,
        growth_rate: liability.annual_increase_percent || 0,
        loan_type: liability.loan_type || null,
        principal_amount: liability.principal_amount || null,
        interest_rate: liability.interest_rate || null,
        loan_term_months: liability.loan_term_months || null,
        loan_start_date: liability.loan_start_date || null,
        monthly_payment: liability.monthly_payment || null
      }));

      // Convert income items to ProjectedAccountCreate format
      const incomeAccounts = (incomeItems || []).map(income => {
        // Handle dynamic items (linked to asset)
        let accountName = income.description;
        let contribution = 0.0;
        
        if (income.linked_item_type === "asset" && income.percentage !== null && income.percentage !== undefined) {
          // This is a dynamic item - will be recalculated each year in backend
          // Check for multi-select linked assets first
          if (income.linked_asset_ids && income.linked_asset_ids.length > 0) {
            // Multi-select: Get all linked asset names
            const linkedAssets = assets.filter(a => income.linked_asset_ids.includes(a.id));
            if (linkedAssets.length > 0) {
              const assetNames = linkedAssets.map(a => a.name).join(',');
              accountName = `${income.description}|LINKED:${assetNames}|PERCENTAGE:${income.percentage}`;
            }
          } else if (income.linked_item_id) {
            // Single linked asset (backward compatibility)
            const linkedAsset = assets.find(a => a.id === income.linked_item_id);
            if (linkedAsset) {
              accountName = `${income.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${income.percentage}`;
            }
          }
        } else {
          // Fixed income item
          contribution = income.yearly_value / 12; // Convert yearly to monthly
        }
        
        return {
          name: accountName,
          account_type: 'income',
          initial_value: 0.0,
          contribution: contribution,
          growth_rate: income.annual_increase_percent || 0,
          loan_type: null,
          principal_amount: null,
          interest_rate: null,
          loan_term_months: null,
          loan_start_date: null,
          monthly_payment: null,
          start_date: income.start_date || null,
          end_date: income.end_date || null
        };
      });

      // Convert expense items to ProjectedAccountCreate format
      // Include ALL expenses (even those that contribute to assets, as they reduce cash flow)
      const expenseAccounts = (expenseItems || []).map(expense => {
          // Handle dynamic items (linked to asset)
          let accountName = expense.description;
          let contribution = 0.0;
          
          if (expense.linked_item_id && expense.linked_item_type === "asset" && expense.percentage !== null && expense.percentage !== undefined) {
            // This is a dynamic item - will be recalculated each year in backend
            // Find the linked asset name
            const linkedAsset = assets.find(a => a.id === expense.linked_item_id);
            if (linkedAsset) {
              accountName = `${expense.description}|LINKED:${linkedAsset.name}|PERCENTAGE:${expense.percentage}`;
            }
          } else {
            // Fixed expense item
            contribution = -(expense.yearly_value / 12); // Negative for expenses, convert yearly to monthly
          }
          
          return {
            name: accountName,
            account_type: 'expense',
            initial_value: 0.0,
            contribution: contribution,
            growth_rate: expense.inflation_percent || 0,
            loan_type: null,
            principal_amount: null,
            start_date: expense.start_date || null,
            end_date: expense.end_date || null,
            interest_rate: null,
            loan_term_months: null,
            loan_start_date: null,
            monthly_payment: null
          };
        });

      const allAccounts = [...assetAccounts, ...liabilityAccounts, ...incomeAccounts, ...expenseAccounts];
      
      // Create projection request
      const projectionRequest = {
        plan_name: "Balance Sheet Projection",
        years: projectionYears,
        accounts: allAccounts
      };

      // Check if a "Balance Sheet Projection" already exists and update it, otherwise create new
      let projectionId = null;
      try {
        const existingProjections = await ProjectionService.getProjections();
        const existing = existingProjections.find(p => p.name === "Balance Sheet Projection");
        if (existing) {
          projectionId = existing.id;
        }
      } catch (e) {
        console.log("Could not check for existing projection, will create new one");
      }

      let projection;
      if (projectionId) {
        // Update existing projection
        projection = await ProjectionService.updateProjection(projectionId, projectionRequest);
      } else {
        // Create new projection
        projection = await ProjectionService.createProjection(projectionRequest);
      }

      // Parse the data_json
      if (projection.data_json) {
        const parsedData = JSON.parse(projection.data_json);
        setProjectionData(parsedData);
      } else {
        // Fetch full projection details if data_json not in response
        const fullProjection = await ProjectionService.getProjectionDetails(projection.id || projectionId);
        if (fullProjection.data_json) {
          const parsedData = JSON.parse(fullProjection.data_json);
          setProjectionData(parsedData);
        }
      }
    } catch (err) {
      console.error("Error fetching projection data:", err);
      setError(err.message || "Failed to calculate projections");
    } finally {
      setLoading(false);
    }
  }, [assets, liabilities, incomeItems, expenseItems, projectionYears]);

  useEffect(() => {
    fetchProjectionData();
  }, [fetchProjectionData]);

  // Parse projection data into the format needed for charts/tables
  const parseProjectionData = () => {
    if (!projectionData || !Array.isArray(projectionData) || projectionData.length === 0) {
      return {
        years: [],
        totalAssetValues: [],
        totalLiabilityValues: [],
        netWorthValues: [],
        individualAssetProjections: [],
        individualLiabilityProjections: []
      };
    }

    const years = projectionData.map(dp => dp.Year || (currentYear + dp.year - 1));
    const totalAssetValues = projectionData.map(dp => dp["Total Assets"] || 0);
    const totalLiabilityValues = projectionData.map(dp => Math.abs(dp["Total Liabilities"] || 0)); // Convert to positive for display
    const netWorthValues = projectionData.map(dp => dp["Net Worth"] || 0);

    // Extract individual asset projections
    const individualAssetProjections = assets.map(asset => {
      const key = `${asset.name}_Value`;
      const projectedValues = projectionData.map(dp => {
        const value = dp[key] || 0;
        return Math.max(0, value); // Ensure non-negative for assets
      });
      return {
        ...asset,
        projectedValues
      };
    });

    // Extract individual liability projections
    const individualLiabilityProjections = liabilities.map(liability => {
      const key = `${liability.name}_Value`;
      const projectedValues = projectionData.map(dp => {
        const value = dp[key] || 0;
        return Math.abs(value); // Convert to positive for display (backend stores as negative)
      });
      return {
        ...liability,
        projectedValues
      };
    });

    return {
      years,
      totalAssetValues,
      totalLiabilityValues,
      netWorthValues,
      individualAssetProjections,
      individualLiabilityProjections
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: `Financial Project - Overall Financial Snapshot${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Show every 5th year in tables
  const displayYearsIndices = [];
  if (projectionData && projectionData.length > 0) {
    for (let i = 0; i < projectionData.length; i++) {
      if (i % 5 === 0 || i === projectionData.length - 1) {
        displayYearsIndices.push(i);
      }
    }
  }

  // Download functions
  const handleDownloadChartPng = (chartRef, filename) => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${filename.replace(/\s/g, '_')}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      console.error("Chart ref is not available for PNG download.");
    }
  };

  const handleDownloadChartPdf = (chartRef, filename) => {
    if (chartRef.current) {
      const chartImage = chartRef.current.toBase64Image('image/png', 1);
      const pdf = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape
      const imgProps = pdf.getImageProperties(chartImage);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(chartImage, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
      console.error("Chart ref is not available for PDF download.");
    }
  };

  const handleDownloadTablePdf = async (tableRef, filename) => {
    if (tableRef.current) {
      const canvas = await html2canvas(tableRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
      console.error("Table ref is not available for PDF download.");
    }
  };

  const handleDownloadCombinedProjectionCsv = (filename) => {
    const { years, totalAssetValues, totalLiabilityValues, netWorthValues } = parseProjectionData();
    if (years.length === 0) return;

    const headers = ['Year', 'Total Assets', 'Total Liabilities', 'Net Worth'];
    const csvRows = [headers.join(',')];

    years.forEach((year, index) => {
      const row = [
        year,
        totalAssetValues[index] || 0,
        totalLiabilityValues[index] || 0,
        netWorthValues[index] || 0
      ].map(val => `"${val}"`);
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  const handleDownloadIndividualProjectionsCsv = (items, filename) => {
    const { years, individualAssetProjections, individualLiabilityProjections } = parseProjectionData();
    if (years.length === 0) return;

    const isAssets = items === individualAssetProjections;
    const headers = ['Name', ...years.map(y => String(y))];
    const csvRows = [headers.join(',')];

    items.forEach(item => {
      const row = [
        item.name,
        ...(isAssets ? item.projectedValues : item.projectedValues).map(val => formatCurrency(val).replace(/[$,]/g, ''))
      ].map(val => `"${val}"`);
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  if (loading) {
    return <div>Loading projections...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const {
    years,
    totalAssetValues,
    totalLiabilityValues,
    netWorthValues,
    individualAssetProjections,
    individualLiabilityProjections
  } = parseProjectionData();

  if (years.length === 0) {
    return <div>No projection data available</div>;
  }

  return (
    <div className="balance-sheet-projection">
      <h2>Balance Sheet Projections</h2>

      {/* Overall Financial Snapshot Chart */}
      <h3>Overall Financial Snapshot</h3>
      <div style={{ marginBottom: "30px" }}>
        <div className="chart-actions">
          <button onClick={() => handleDownloadChartPng(overallChartRef, "Overall_Financial_Snapshot")}>Download PNG</button>
          <button onClick={() => handleDownloadChartPdf(overallChartRef, "Overall_Financial_Snapshot")}>Download PDF</button>
        </div>
        <Line
          ref={overallChartRef}
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

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(overallTableRef, "Overall_Financial_Snapshot_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadCombinedProjectionCsv("Overall_Financial_Snapshot_Table")}>Download CSV</button>
      </div>
      <table ref={overallTableRef} className="cashflow-table">
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
        <div className="chart-actions">
          <button onClick={() => handleDownloadChartPng(individualAssetChartRef, "Individual_Asset_Projections")}>Download PNG</button>
          <button onClick={() => handleDownloadChartPdf(individualAssetChartRef, "Individual_Asset_Projections")}>Download PDF</button>
        </div>
        <Line
          ref={individualAssetChartRef}
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
          options={{
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              title: {
                ...chartOptions.plugins.title,
                text: `Financial Project - Individual Asset Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
              },
            },
          }}
        />
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(individualAssetTableRef, "Individual_Asset_Projections_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadIndividualProjectionsCsv(individualAssetProjections, "Individual_Asset_Projections_Table")}>Download CSV</button>
      </div>
      <table ref={individualAssetTableRef} className="cashflow-table" style={{ marginBottom: "50px" }}>
        <thead>
          <tr>
            <th>Asset Name (Category)</th>
            {displayYearsIndices.map((index) => (
              <th key={years[index]}>{years[index]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {individualAssetProjections.map((asset) => (
            <tr key={asset.id}>
              <td>{`${asset.name} (${asset.category})`}</td>
              {displayYearsIndices.map((index) => (
                <td key={years[index]}>{formatCurrency(asset.projectedValues[index])}</td>
              ))}
            </tr>
          ))}
          {showChartTotals && (
            <tr>
              <td><b>Total Assets</b></td>
              {displayYearsIndices.map(index => (
                <td key={`total-asset-${years[index]}`}><b>{formatCurrency(totalAssetValues[index])}</b></td>
              ))}
            </tr>
          )}
        </tbody>
      </table>

      {/* Individual Liability Projections Chart */}
      {liabilities.length > 0 && (
        <h3 style={{ marginTop: "50px" }}>Individual Liability Projections</h3>
      )}
      {liabilities.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <div className="chart-actions">
            <button onClick={() => handleDownloadChartPng(individualLiabilityChartRef, "Individual_Liability_Projections")}>Download PNG</button>
            <button onClick={() => handleDownloadChartPdf(individualLiabilityChartRef, "Individual_Liability_Projections")}>Download PDF</button>
          </div>
          <Line
            ref={individualLiabilityChartRef}
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
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  ...chartOptions.plugins.title,
                  text: `Financial Project - Individual Liability Projections${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
                },
              },
            }}
          />
        </div>
      )}

      {liabilities.length > 0 && (
        <div className="table-actions">
          <button onClick={() => handleDownloadTablePdf(individualLiabilityTableRef, "Individual_Liability_Projections_Table")}>Download PDF</button>
          <button onClick={() => handleDownloadIndividualProjectionsCsv(individualLiabilityProjections, "Individual_Liability_Projections_Table")}>Download CSV</button>
        </div>
      )}
      {liabilities.length > 0 && (
        <table ref={individualLiabilityTableRef} className="cashflow-table">
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
