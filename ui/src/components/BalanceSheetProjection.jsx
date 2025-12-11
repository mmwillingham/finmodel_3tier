import React, { useRef } from "react";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Line } from "react-chartjs-2";

export default function BalanceSheetProjection({ assets, liabilities, projectionYears, formatCurrency, showChartTotals }) {
  const currentYear = new Date().getFullYear();
  const overallChartRef = useRef(null);
  const overallTableRef = useRef(null);
  const individualAssetChartRef = useRef(null);
  const individualAssetTableRef = useRef(null);
  const individualLiabilityChartRef = useRef(null);
  const individualLiabilityTableRef = useRef(null);

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

  const handleDownloadCombinedProjectionCsv = (filename) => {
    if (years.length > 0) {
      const headers = ['Year', 'Total Assets', 'Total Liabilities', 'Net Worth'];
      const formattedData = displayYearsIndices.map(index => ({
        Year: years[index],
        'Total Assets': totalAssetValues[index],
        'Total Liabilities': totalLiabilityValues[index],
        'Net Worth': netWorthValues[index],
      }));
      const csvString = convertToCsv(formattedData, headers, formatCurrency);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for combined projection CSV download.");
    }
  };

  const handleDownloadIndividualProjectionsCsv = (projections, filename) => {
    if (projections.length > 0 && years.length > 0) {
      const headers = ['Name (Category)', ...displayYearsIndices.map(index => years[index])];
      const csvRows = [];
      csvRows.push(headers.join(','));

      projections.forEach(item => {
        const row = [`"${(item.name || '') + (item.category ? ` (${item.category})` : '')}"`];
        displayYearsIndices.forEach(index => {
          row.push(`"${formatCurrency(item.projectedValues[index] || 0).replace(/"/g, '""')}"`);
        });
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename.replace(/\s/g, '_')}.csv`;
      link.click();
    } else {
      console.warn("No data available for individual projections CSV download.");
    }
  };

  return (
    <div className="balance-sheet-projection-container">
      <h2>Balance Sheet Projections</h2>
      
      {/* Combined Assets, Liabilities, Net Worth Chart and Table */}
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
      <div className="chart-actions">
        <button onClick={() => handleDownloadChartPng(individualAssetChartRef, "Individual_Asset_Projections")}>Download PNG</button>
        <button onClick={() => handleDownloadChartPdf(individualAssetChartRef, "Individual_Asset_Projections")}>Download PDF</button>
      </div>
      <div style={{ marginBottom: "30px" }}>
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
          options={chartOptions}
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
        <div className="chart-actions">
          <button onClick={() => handleDownloadChartPng(individualLiabilityChartRef, "Individual_Liability_Projections")}>Download PNG</button>
          <button onClick={() => handleDownloadChartPdf(individualLiabilityChartRef, "Individual_Liability_Projections")}>Download PDF</button>
        </div>
      )}
      {liabilities.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
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
            options={chartOptions}
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
