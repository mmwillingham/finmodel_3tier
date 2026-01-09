import React, { useRef } from "react";
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line } from "react-chartjs-2";

export default function CashFlowOverview({ incomeItems, expenseItems, projectionYears, formatCurrency, assets = [], userSettings = null, autoDisbursements = [] }) {
  const currentYear = new Date().getFullYear();
  const chartRef = useRef(null);
  const tableRef = useRef(null);

  const calculateCashFlowProjection = () => {
    const years = [];
    const incomeValues = [];
    const expenseValues = [];
    const surplus = [];
    const surplusAssetTransfers = []; // NEW: Transfers to surplus asset
    const autoDisbursementTransfers = {}; // NEW: Track each auto-disbursement

    // Initialize auto-disbursement transfer arrays
    autoDisbursements.forEach(ad => {
      autoDisbursementTransfers[ad.id] = [];
    });

    // Pre-calculate asset projections for all years (needed for dynamic items and transfers)
    const assetProjections = {};
    assets.forEach(asset => {
      assetProjections[asset.id] = [];
      for (let year = 0; year <= projectionYears; year++) {
        const growthRate = (asset.annual_increase_percent || 0) / 100;
        let assetValue = asset.value;
        
        // Apply date filters if present
        if (asset.start_date) {
          const startYear = new Date(asset.start_date).getFullYear();
          if (currentYear + year < startYear) {
            assetValue = 0;
          }
        }
        if (asset.end_date) {
          const endYear = new Date(asset.end_date).getFullYear();
          if (currentYear + year > endYear) {
            assetValue = 0;
          }
        }
        
        if (assetValue > 0) {
          assetValue = assetValue * Math.pow(1 + growthRate, year);
        }
        assetProjections[asset.id].push(assetValue);
      }
    });

    for (let year = 0; year <= projectionYears; year++) {
      years.push(year);
      
      let totalIncome = 0;
      incomeItems.forEach((item) => {
        let itemValue = item.yearly_value;
        
        // Handle dynamic items (linked to assets)
        if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
          // Find the linked asset
          const linkedAsset = assets.find(a => a.id === item.linked_item_id);
          if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
            // Recalculate based on projected asset value for this year
            const projectedAssetValue = assetProjections[linkedAsset.id][year];
            itemValue = projectedAssetValue * (item.percentage / 100.0);
          }
        } else {
          // Fixed value item - apply growth rate
          const growthRate = (item.annual_increase_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + growthRate, year);
        }
        
        totalIncome += itemValue;
      });

      let totalExpenses = 0;
      expenseItems.forEach((item) => {
        let itemValue = item.yearly_value;
        
        // Handle dynamic items (linked to assets)
        if (item.linked_item_id && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
          // Find the linked asset
          const linkedAsset = assets.find(a => a.id === item.linked_item_id);
          if (linkedAsset && assetProjections[linkedAsset.id] && assetProjections[linkedAsset.id][year] !== undefined) {
            // Recalculate based on projected asset value for this year
            const projectedAssetValue = assetProjections[linkedAsset.id][year];
            itemValue = projectedAssetValue * (item.percentage / 100.0);
          }
        } else {
          // Fixed value item - apply inflation rate
          const inflationRate = (item.inflation_percent || 0) / 100;
          itemValue = item.yearly_value * Math.pow(1 + inflationRate, year);
        }
        
        totalExpenses += itemValue;
      });

      const yearSurplus = totalIncome - totalExpenses;
      
      // Calculate surplus asset transfer (surplus/deficit goes to surplus asset)
      let surplusTransfer = 0;
      if (userSettings && userSettings.surplus_asset_id) {
        surplusTransfer = yearSurplus; // Positive = surplus, negative = deficit
      }
      
      // Calculate auto-disbursement transfers
      autoDisbursements.forEach(ad => {
        if (!autoDisbursementTransfers[ad.id]) {
          autoDisbursementTransfers[ad.id] = [];
        }
        
        // Check if disbursement is active for this year
        const startYear = ad.start_date ? new Date(ad.start_date).getFullYear() : currentYear;
        const endYear = ad.end_date ? new Date(ad.end_date).getFullYear() : currentYear + projectionYears;
        const currentProjectionYear = currentYear + year;
        
        if (currentProjectionYear >= startYear && (ad.end_date === null || currentProjectionYear <= endYear)) {
          const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
          if (sourceAsset && assetProjections[sourceAsset.id] && assetProjections[sourceAsset.id][year] !== undefined) {
            const sourceValue = assetProjections[sourceAsset.id][year];
            let transferAmount = 0;
            
            if (ad.transfer_type === 'percentage') {
              transferAmount = sourceValue * ((ad.transfer_value || 0) / 100.0);
            } else if (ad.transfer_type === 'fixed') {
              transferAmount = ad.transfer_value || 0;
            }
            
            autoDisbursementTransfers[ad.id].push(transferAmount);
          } else {
            autoDisbursementTransfers[ad.id].push(0);
          }
        } else {
          // Ensure array exists even if outside date range
          if (!autoDisbursementTransfers[ad.id]) {
            autoDisbursementTransfers[ad.id] = [];
          }
          autoDisbursementTransfers[ad.id].push(0);
        }
      });

      incomeValues.push(totalIncome);
      expenseValues.push(totalExpenses);
      surplus.push(yearSurplus);
      surplusAssetTransfers.push(surplusTransfer);
    }

    return { years, incomeValues, expenseValues, surplus, surplusAssetTransfers, autoDisbursementTransfers };
  };

  const cashFlowProjection = calculateCashFlowProjection();

  // Build datasets array dynamically
  const datasets = [
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
  ];

  // Add surplus asset transfer if configured
  if (userSettings && userSettings.surplus_asset_id && cashFlowProjection.surplusAssetTransfers.length > 0) {
    const surplusAsset = assets.find(a => a.id === userSettings.surplus_asset_id);
    const surplusAssetName = surplusAsset ? surplusAsset.name : 'Surplus Asset';
    datasets.push({
      label: `Transfer to ${surplusAssetName}`,
      data: cashFlowProjection.surplusAssetTransfers,
      borderColor: "rgb(255, 165, 0)",
      backgroundColor: "rgba(255, 165, 0, 0.2)",
      borderDash: [5, 5], // Dashed line to differentiate from income/expenses
      pointRadius: 3, // Ensure points are visible
      pointHoverRadius: 5,
      spanGaps: false, // Don't span gaps
      tension: 0.1, // Add slight curve for better visibility
    });
  }

  // Add auto-disbursement transfers
  autoDisbursements.forEach(ad => {
    if (cashFlowProjection.autoDisbursementTransfers && cashFlowProjection.autoDisbursementTransfers[ad.id] && cashFlowProjection.autoDisbursementTransfers[ad.id].length > 0) {
      const sourceAsset = assets.find(a => a.id === ad.source_asset_id);
      const targetAsset = assets.find(a => a.id === ad.target_asset_id);
      const sourceName = sourceAsset ? sourceAsset.name : 'Source';
      const targetName = targetAsset ? targetAsset.name : 'Target';
      datasets.push({
        label: `Auto-Disbursement: ${sourceName} → ${targetName}`,
        data: cashFlowProjection.autoDisbursementTransfers[ad.id],
        borderColor: "rgb(128, 128, 128)",
        backgroundColor: "rgba(128, 128, 128, 0.2)",
        borderDash: [3, 3], // Dashed line for transfers
      });
    }
  });

  const cashFlowChartData = {
    labels: cashFlowProjection.years.map(year => currentYear + year), // Adjust labels to current year
    datasets: datasets,
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: `Financial Project - Income & Expense Projection${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
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

  // Download functions (reusing from ProjectionDetail.js pattern)
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

  const convertToCsv = (dataArray, headers, valueFormatter) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    dataArray.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        if (typeof value === 'number' && valueFormatter) {
          return `"${valueFormatter(value).replace(/"/g, '""')}"`; // Format currency and escape quotes
        }
        return `"${String(value).replace(/"/g, '""')}"`; // Escape double quotes for CSV
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  };

  const handleDownloadCashFlowCsv = (filename) => {
    if (cashFlowProjection.years.length > 0) {
      const headers = ['Year', 'Income', 'Expenses', 'Surplus'];
      const formattedData = cashFlowProjection.years.map(year => ({
        Year: currentYear + year,
        Income: cashFlowProjection.incomeValues[year],
        Expenses: cashFlowProjection.expenseValues[year],
        Surplus: cashFlowProjection.surplus[year],
      }));
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for Cash Flow CSV download.");
    }
  };

  return (
    <div className="cashflow-overview-container">
      <h3>Income & Expense Projection</h3>
      <div style={{ marginBottom: "30px" }}>
        <div className="chart-actions">
          <button onClick={() => handleDownloadChartPng(chartRef, "Income_Expense_Projection")}>Download PNG</button>
          <button onClick={() => handleDownloadChartPdf(chartRef, "Income_Expense_Projection")}>Download PDF</button>
        </div>
        <Line ref={chartRef} data={cashFlowChartData} options={chartOptions} />
      </div>

      <div className="table-actions">
        <button onClick={() => handleDownloadTablePdf(tableRef, "Cash_Flow_Overview_Table")}>Download PDF</button>
        <button onClick={() => handleDownloadCashFlowCsv("Cash_Flow_Overview_Table")}>Download CSV</button>
      </div>
      <table ref={tableRef} className="cashflow-table">
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
              <td>{currentYear + year}</td>
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
