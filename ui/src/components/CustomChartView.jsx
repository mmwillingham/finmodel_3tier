import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas'; // Added import for html2canvas
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import CustomChartService from '../services/customChart.service';
import './CustomChartView.css'; // We will create this CSS file

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function CustomChartView({ chartId, assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, onBack }) {
  const { userSettings } = useAuth();
  const [chartConfig, setChartConfig] = useState(null);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const chartRef = useRef(null);
  const tableRef = useRef(null); // New ref for the table
  const currentYear = new Date().getFullYear();
  const [showChartTotals, setShowChartTotals] = useState(true); // State for individual chart totals
  const [currentDisplayType, setCurrentDisplayType] = useState("chart"); // New state for display type

  const prepareChartData = useCallback((fetchedConfig) => {
    let parsedDataJson = [];
    try {
      parsedDataJson = JSON.parse(fetchedConfig.data_json);
      console.log("DEBUG (CustomChartView.jsx): Parsed data_json inside prepareChartData:", parsedDataJson);
    } catch (e) {
      console.error("Error parsing data_json in prepareChartData:", e);
      setMessage("Error processing chart data from the server.");
      setChartData({ labels: [], datasets: [] });
      return;
    }

    if (!Array.isArray(parsedDataJson) || parsedDataJson.length === 0) {
      setMessage("No data available for the chart from server response.");
      setChartData({ labels: [], datasets: [] });
      return;
    }

    const labels = parsedDataJson.map(dataPoint => dataPoint.Year);
    let datasets = [];

    try {
      const seriesConfigurations = JSON.parse(fetchedConfig.series_configurations);
      console.log("DEBUG (CustomChartView.jsx): Parsed series_configurations:", seriesConfigurations);

      seriesConfigurations.forEach((series) => {
        console.log("DEBUG (CustomChartView.jsx): Processing series with label:", series.label);

        const dataValues = parsedDataJson.map(dataPoint => {
          // Construct the key for the data point, e.g., "InvestIncomeNew_Value"
          let valueForSeries = 0;
          let debugDataKey = "N/A (aggregated)"; // Initialize for aggregated case

          if (series.aggregation === "sum" && series.category === "Investment Income") {
            // TEMPORARY: Hardcoding aggregation for "Investment Income" category.
            // This assumes "Investment Income" sums InterestTest_Value and dividends_Value.
            // A more robust solution requires backend changes to provide category mapping.
            const interestValue = dataPoint["InterestTest_Value"] || 0;
            const dividendsValue = dataPoint["dividends_Value"] || 0;
            valueForSeries = interestValue + dividendsValue;
            debugDataKey = `InterestTest_Value (${interestValue}) + dividends_Value (${dividendsValue})`; // More detailed logging
          } else {
            // Fallback for other series: attempt direct lookup using series.label
            const dataKey = `${series.label}_Value`;
            valueForSeries = dataPoint[dataKey] || 0;
            debugDataKey = dataKey; // For logging clarity
          }
          console.log(`DEBUG (CustomChartView.jsx): dataPoint for Year ${dataPoint.Year}, series label: ${series.label}, category: ${series.category}, dataKey(s) sought: ${debugDataKey}, final value: ${valueForSeries}`); // Updated log statement
          return dataPoint[dataKey] || 0; // Use 0 if the key is not found
        });

        datasets.push({
          label: series.label,
          data: dataValues,
          borderColor: series.color,
          backgroundColor: series.color + "40", // Add some transparency
          fill: false,
          tension: 0.1,
          ...(fetchedConfig.chart_type === 'bar' && { backgroundColor: series.color }),
          ...(fetchedConfig.chart_type === 'pie' && { backgroundColor: series.color, borderColor: '#fff', borderWidth: 1 }),
        });
      });

      // Calculate and add Total line if showChartTotals is true
      if (showChartTotals && (fetchedConfig.chart_type === 'line' || fetchedConfig.chart_type === 'bar')) {
        const totalDataValues = labels.map((_, yearIndex) => {
          let sum = 0;
          datasets.forEach(dataset => {
            sum += dataset.data[yearIndex] || 0;
          });
          return sum;
        });

        datasets.push({
          label: 'Total',
          data: totalDataValues,
          borderColor: '#000000', // Black color for total line
          backgroundColor: '#000000', // Black color for total line
          fill: false,
          tension: 0.1,
          borderWidth: 3, // Thicker line for total
          pointRadius: 4,
          pointBackgroundColor: '#000000',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#000000',
          pointHoverBorderColor: '#ffffff',
          borderDash: [5, 5], // Dashed line for total
        });
      }

    } catch (e) {
      console.error("Error parsing series configurations or preparing data:", e);
      setMessage("Error preparing chart data.");
      datasets = []; // Ensure datasets is empty on error
    }

    setChartData({ labels, datasets });
    console.log("DEBUG (CustomChartView.jsx): Chart data prepared (labels, datasets):", { labels, datasets });
  }, [showChartTotals]); // Removed other dependencies as data_json is the source

  useEffect(() => {
    const fetchAndPrepareChart = async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await CustomChartService.get(chartId);
        const fetchedConfig = response.data;
        setChartConfig(fetchedConfig);
        setCurrentDisplayType(fetchedConfig.display_type || "chart"); // Set display type from fetched config
        console.log("DEBUG (CustomChartView.jsx): Fetched chart config:", fetchedConfig);
        try {
          const parsedDataJson = JSON.parse(fetchedConfig.data_json);
          console.log("DEBUG (CustomChartView.jsx): Parsed data_json in useEffect:", parsedDataJson);
        } catch (parseError) {
          console.error("DEBUG (CustomChartView.jsx): Error parsing data_json in useEffect:", parseError);
        }
        prepareChartData(fetchedConfig); // Call the memoized function
      } catch (error) {
        console.error("Error fetching custom chart:", error);
        setMessage("Failed to load chart configuration.");
      } finally {
        setLoading(false);
      }
    };

    if (chartId) {
      fetchAndPrepareChart();
    }
  }, [chartId, prepareChartData]); // prepareChartData is a dependency

  const getChartComponent = () => {
    if (!chartConfig || chartData.datasets.length === 0) return null;

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `Financial Project - ${chartConfig.name}${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatCurrency(context.parsed.y);
              } else if (context.parsed !== null) { // For pie charts, context.parsed is a single value
                label += formatCurrency(context.parsed);
              }
              return label;
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: !!chartConfig.x_axis_label,
            text: chartConfig.x_axis_label,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: !!chartConfig.y_axis_label,
            text: chartConfig.y_axis_label,
          },
          ticks: {
            callback: function(value) {
              return formatCurrency(value);
            }
          }
        },
      },
      ...(chartConfig.chart_type === 'pie' && {
        scales: { // No scales for pie chart
          x: { display: false },
          y: { display: false },
        },
        plugins: { // Re-configure plugins for pie charts specifically
          legend: { position: 'top' },
          title: { display: true, text: `Financial Project - ${chartConfig.name}${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}` },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed !== null) {
                  label += formatCurrency(context.parsed);
                }
                return label;
              }
            }
          },
        }
      })
    };

    switch (chartConfig.chart_type) {
      case 'line':
        return <Line ref={chartRef} data={chartData} options={options} />;
      case 'bar':
        return <Bar ref={chartRef} data={chartData} options={options} />;
      case 'pie':
        // For pie charts, we don't have a "sum of lines" concept, as it's a single point in time aggregate.
        // The `showChartTotals` will not apply to pie charts in this context.
        const pieLabels = chartData.datasets.map(ds => ds.label);
        const pieDataValues = chartData.datasets.map(ds => ds.data.reduce((sum, val) => sum + val, 0)); // Sum all values for pie
        const pieBackgroundColors = chartData.datasets.map(ds => ds.backgroundColor);
        const pieBorderColors = chartData.datasets.map(ds => ds.borderColor);

        return <Pie 
          ref={chartRef}
          data={{
            labels: pieLabels,
            datasets: [{
              data: pieDataValues,
              backgroundColor: pieBackgroundColors,
              borderColor: pieBorderColors,
              borderWidth: 1,
            }],
          }}
          options={options} // Use the consolidated options object
        />;
      default:
        return <p>Unsupported chart type: {chartConfig.chart_type}</p>;
    }
  };

  const handleDownloadCsv = (filename) => {
    if (chartData.datasets.length === 0) {
      console.warn("No data available for CSV download.");
      return;
    }

    const headerRow = ["Year", ...chartData.datasets.map(d => d.label)];
    const csvRows = [headerRow.join(',')];

    chartData.labels.forEach((year, yearIndex) => {
      const row = [year];
      chartData.datasets.forEach(dataset => {
        row.push(dataset.data[yearIndex]);
      });
      csvRows.push(row.join(','));
    });

    let csvString = '';
    csvRows.forEach((row, index) => {
        csvString += row;
        if (index < csvRows.length - 1) {
            csvString += '\n'; // Use escaped newline character explicitly
        }
    });

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  const handleDownloadPng = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${chartConfig.name.replace(/\s/g, '_') || 'chart'}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      console.error("Chart ref is not available for PNG download.");
      setMessage("Error: Chart not ready for download.");
    }
  };

  const handleDownloadPdf = async (ref, filename) => {
    if (ref.current) {
      const element = ref.current.canvas ? ref.current.canvas : ref.current; // For Chart.js, ref.current is the chart instance, for table it's the DOM element
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename.replace(/\s/g, '_')}.pdf`);
    } else {
      console.error("Ref is not available for PDF download.");
      setMessage("Error: Element not ready for download.");
    }
  };

  if (loading) {
    return <div className="loading">Loading chart...</div>;
  }

  if (message) {
    return <div className="message error">{message}</div>;
  }

  return (
    <div className="custom-chart-view-container">
      <button onClick={onBack} className="back-btn">← Back to Custom Charts and Tables</button>
      <div className="chart-actions">
        {(currentDisplayType === "chart" || currentDisplayType === "both") && (
          <>
            <button onClick={handleDownloadPng} className="download-btn">Download Chart PNG</button>
            <button onClick={() => handleDownloadPdf(chartRef, `${chartConfig.name}_Chart`)} className="download-btn">Download Chart PDF</button>
          </>
        )}
        <label className="show-totals-toggle">
          <input
            type="checkbox"
            checked={showChartTotals}
            onChange={(e) => setShowChartTotals(e.target.checked)}
          />
          Show Chart Totals
        </label>
      </div>
      <div className="chart-display-area">
        {(currentDisplayType === "chart" || currentDisplayType === "both") && (
          <div className="chart-container">
            {getChartComponent()}
          </div>
        )}

        {(currentDisplayType === "table" || currentDisplayType === "both") && chartData.datasets.length > 0 && (
          <div className="table-container">
            <h3>Year-by-Year Breakdown</h3>
            <table ref={tableRef} className="custom-chart-table">
              <thead>
                <tr>
                  <th>Year</th>
                  {chartData.datasets.map(dataset => (
                    <th key={dataset.label}>{dataset.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.labels.map((year, yearIndex) => (
                  <tr key={year}>
                    <td>{year}</td>
                    {chartData.datasets.map(dataset => (
                      <td key={`${year}-${dataset.label}`}>{formatCurrency(dataset.data[yearIndex])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Download buttons for table */}
            <div className="table-actions">
              <button onClick={() => handleDownloadPdf(tableRef, `${chartConfig.name}_Table`)} className="download-btn">Download Table PDF</button>
              <button onClick={() => handleDownloadCsv(`${chartConfig.name}_Table`)} className="download-btn">Download Table CSV</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}