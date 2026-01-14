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

export default function CustomChartView({ chartId, assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, onBack, onEdit }) {
  const { userSettings } = useAuth();
  const [chartConfig, setChartConfig] = useState(null);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const chartRef = useRef(null);
  const tableRef = useRef(null); // New ref for the table
  const currentYear = new Date().getFullYear();
  const [showChartTotals, setShowChartTotals] = useState(false); // State for individual chart totals
  const [showChartTotalsDisabled, setShowChartTotalsDisabled] = useState(false); // State to disable totals checkbox when data types differ
    const [currentDisplayType, setCurrentDisplayType] = useState("chart"); // New state for display type (chart, table, or both)

  const formatValue = useCallback((value, displayType) => {
    if (displayType === 'percentage') {
      return `${(value * 100).toFixed(2)}%`;
    } else { // Default to currency
      return formatCurrency(value);
    }
  }, [formatCurrency]);

  const getAggregatedValue = useCallback((dataPoint, series) => {
    let sum = 0;
    const targetDataType = series.data_type;
    const targetCategory = series.category;
    const targetLabel = series.label; // Label is ONLY for display, never used for matching
    const selectedItemId = series.selected_item_id || series.item_id; // Check for specific item selection

    // Debug logging (set to false to disable)
    const DEBUG_MODE = false; // Set to true for detailed debugging
    if (DEBUG_MODE && targetDataType === 'expenses') {
      console.log(`DEBUG getAggregatedValue START: targetLabel: "${targetLabel}" (display only), targetCategory: "${targetCategory}", selectedItemId: ${selectedItemId}`);
      console.log(`DEBUG getAggregatedValue: expenseItems:`, expenseItems.map(e => ({ id: e.id, description: e.description, category: e.category })));
    }

    // If a specific item is selected (by ID), find it first to get its description
    let selectedItem = null;
    if (selectedItemId && selectedItemId !== "" && selectedItemId !== null && selectedItemId !== 0) {
      // Convert selectedItemId to number for comparison (handles string/number mismatch)
      const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
      if (targetDataType === 'assets') {
        selectedItem = assets.find(a => a.id === itemIdNum || a.id === selectedItemId);
      } else if (targetDataType === 'liabilities') {
        selectedItem = liabilities.find(l => l.id === itemIdNum || l.id === selectedItemId);
      } else if (targetDataType === 'income') {
        selectedItem = incomeItems.find(i => i.id === itemIdNum || i.id === selectedItemId);
      } else if (targetDataType === 'expenses') {
        selectedItem = expenseItems.find(e => e.id === itemIdNum || e.id === selectedItemId);
      }
      
      if (DEBUG_MODE && selectedItem) {
        console.log(`DEBUG getAggregatedValue: Found selected item by ID ${selectedItemId}:`, { description: selectedItem.description || selectedItem.name, category: selectedItem.category });
      }
    }

    // Special handling for amortized liabilities - use selectedItem if available, otherwise fallback to label
    if (targetDataType === 'liabilities' && selectedItem && selectedItem.loan_type === 'amortized') {
        // Backend stores amortized liability balance as "LoanName_Value"
        const liabilityName = selectedItem.name;
        const valueKey = `${liabilityName}_Value`;
        const value = dataPoint[valueKey] || 0;
        // Return absolute value since liabilities are displayed as positive
        return Math.abs(value);
    }

    for (const key in dataPoint) {
      if (key.endsWith('_Value')) {
        let itemNameFromKey = key.replace('_Value', '');
        // Extract base name if it contains LINKED markers (for dynamic items)
        // Handle both |LINKED: (for assets) and |LINKED_INCOME: (for expenses linked to income)
        if (itemNameFromKey.includes('|LINKED_INCOME:')) {
          itemNameFromKey = itemNameFromKey.split('|LINKED_INCOME:')[0];
        } else if (itemNameFromKey.includes('|LINKED:')) {
          itemNameFromKey = itemNameFromKey.split('|LINKED:')[0];
        }
        const value = dataPoint[key] || 0;

        // Find the item in the appropriate array to get its category
        let itemCategory = null;
        let itemMatchesDataType = false;
        let itemName = null;

        if (targetDataType === 'assets') {
          const item = assets.find(a => a.name === itemNameFromKey);
          if (item) {
            itemCategory = item.category;
            itemName = item.name;
            itemMatchesDataType = true;
          }
        } else if (targetDataType === 'liabilities') {
          const item = liabilities.find(l => l.name === itemNameFromKey && l.loan_type !== 'amortized');
          if (item) {
            itemCategory = item.category;
            itemName = item.name;
            itemMatchesDataType = true;
          }
        } else if (targetDataType === 'income') {
          const item = incomeItems.find(i => i.description === itemNameFromKey);
          if (item) {
            itemCategory = item.category;
            itemName = item.description;
            itemMatchesDataType = true;
          }
        } else if (targetDataType === 'expenses') {
          const item = expenseItems.find(e => e.description === itemNameFromKey);
          if (item) {
            itemCategory = item.category;
            itemName = item.description;
            itemMatchesDataType = true;
          }
        }

        if (itemMatchesDataType) {
          // Debug logging
          if (DEBUG_MODE && targetDataType === 'expenses') {
            console.log(`DEBUG getAggregatedValue: Checking expense - itemNameFromKey: "${itemNameFromKey}", itemName: "${itemName}", itemCategory: "${itemCategory}", targetCategory: "${targetCategory}", selectedItem:`, selectedItem ? { id: selectedItem.id, description: selectedItem.description || selectedItem.name } : null, `value: ${value}`);
          }
          
          // Matching logic (label is NEVER used for matching):
          // 1. If a specific item is selected (by ID), match by item description/name
          if (selectedItem) {
            const selectedItemName = selectedItem.description || selectedItem.name;
            if (itemName === selectedItemName) {
              sum += value;
              if (DEBUG_MODE && targetDataType === 'expenses') {
                console.log(`DEBUG getAggregatedValue: Matched by selectedItem ID (${selectedItemId}) - itemName: "${itemName}", selectedItemName: "${selectedItemName}", value: ${value}, sum now: ${sum}`);
              }
            } else if (DEBUG_MODE && targetDataType === 'expenses') {
              console.log(`DEBUG getAggregatedValue: Selected item name mismatch - itemName: "${itemName}", selectedItemName: "${selectedItemName}"`);
            }
          } 
          // 2. If category is specified, match by category
          else if (targetCategory && targetCategory !== "") {
            if (itemCategory === targetCategory) {
              sum += value;
              if (DEBUG_MODE && targetDataType === 'expenses') {
                console.log(`DEBUG getAggregatedValue: Matched by category "${targetCategory}", value: ${value}, sum now: ${sum}`);
              }
            } else if (DEBUG_MODE && targetDataType === 'expenses') {
              console.log(`DEBUG getAggregatedValue: Category mismatch - itemCategory: "${itemCategory}", targetCategory: "${targetCategory}"`);
            }
          } 
          // 3. Otherwise, include all items of the target data type
          else {
            sum += value;
            if (DEBUG_MODE && targetDataType === 'expenses') {
              console.log(`DEBUG getAggregatedValue: Matched by data type (no filters), value: ${value}, sum now: ${sum}`);
            }
          }
        } else if (DEBUG_MODE && targetDataType === 'expenses') {
          console.log(`DEBUG getAggregatedValue: Item not found in expenseItems - itemNameFromKey: "${itemNameFromKey}", available expenses:`, expenseItems.map(e => ({ id: e.id, description: e.description })));
        }
      }
    }

    // Special handling for expenses and liabilities to display as positive values if needed
    if (targetDataType === 'expenses' || (targetDataType === 'liabilities' && sum < 0)) {
      return Math.abs(sum);
    }
    return sum;
  }, [assets, liabilities, incomeItems, expenseItems]); // Added dependencies for helper function

  const prepareChartData = useCallback((fetchedConfig) => {
    let parsedDataJson = [];
    try {
      parsedDataJson = JSON.parse(fetchedConfig.data_json);
      console.log("DEBUG (CustomChartView.jsx): Parsed data_json inside prepareChartData:", parsedDataJson); // RE-ADDED LOG
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
      console.log("DEBUG (CustomChartView.jsx): Parsed series_configurations:", seriesConfigurations); // RE-ADDED LOG

      seriesConfigurations.forEach((series) => {
        console.log("DEBUG (CustomChartView.jsx): Processing series:", series.label, "(Category:", series.category, ")"); // RE-ADDED LOG

        const dataValues = parsedDataJson.map(dataPoint => {
          const valueForSeries = getAggregatedValue(dataPoint, series);
          return valueForSeries;
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
    console.log("DEBUG (CustomChartView.jsx): Chart data prepared (labels, datasets):", { labels, datasets }); // RE-ADDED LOG
  }, [showChartTotals, getAggregatedValue, assets, liabilities, incomeItems, expenseItems]); // Added all necessary dependencies

  useEffect(() => {
    const fetchAndPrepareChart = async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await CustomChartService.get(chartId);
        const fetchedConfig = response.data;
        setChartConfig(fetchedConfig);
        setCurrentDisplayType(fetchedConfig.display_type || "chart"); // Set display type from fetched config
        console.log("DEBUG (CustomChartView.jsx): currentDisplayType set to:", fetchedConfig.display_type || "chart"); // RE-ADDED LOG
        console.log("DEBUG (CustomChartView.jsx): Fetched chart config:", fetchedConfig);
        try {
          const parsedDataJson = JSON.parse(fetchedConfig.data_json);
          console.log("DEBUG (CustomChartView.jsx): Parsed data_json in useEffect:", parsedDataJson); // RE-ADDED LOG
        } catch (parseError) {
          console.error("DEBUG (CustomChartView.jsx): Error parsing data_json in useEffect:", parseError);
        }
        // Check if series have different data types - if so, disable totals
        try {
          const seriesConfigurations = JSON.parse(fetchedConfig.series_configurations);
          const dataTypes = seriesConfigurations.map(s => s.data_type);
          const uniqueDataTypes = [...new Set(dataTypes)];
          const hasMultipleDataTypes = uniqueDataTypes.length > 1;
          setShowChartTotalsDisabled(hasMultipleDataTypes);
          if (hasMultipleDataTypes) {
            setShowChartTotals(false); // Automatically uncheck if multiple data types
          }
        } catch (e) {
          console.error("Error parsing series configurations for totals check:", e);
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

    // Listen for chart recalculation events
    const handleChartRecalculated = (event) => {
      const recalculatedChartId = event.detail?.chartId;
      // If this chart was recalculated, or if all charts were recalculated, refresh this chart
      if (recalculatedChartId === chartId || recalculatedChartId === 'all') {
        if (chartId) {
          fetchAndPrepareChart();
        }
      }
    };

    window.addEventListener('chartRecalculated', handleChartRecalculated);

    return () => {
      window.removeEventListener('chartRecalculated', handleChartRecalculated);
    };
  }, [chartId, prepareChartData]); // prepareChartData is a dependency

  const getChartComponent = () => {
    if (!chartConfig || chartData.datasets.length === 0) return null;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${chartConfig.name}${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`,
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatValue(context.parsed.y, "currency"); // Default to currency formatting
              } else if (context.parsed !== null) { // For pie charts, context.parsed is a single value
                label += formatValue(context.parsed, "currency"); // Default to currency formatting
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
              return formatValue(value, "currency"); // Default to currency formatting
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
          title: { display: true, text: `${chartConfig.name}${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}` },
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
        return <p>Unsupported chart type: ${chartConfig.chart_type}</p>;
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
      <div className="chart-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onEdit && (
            <button onClick={() => onEdit(chartId)} className="btn-primary-modern">Edit</button>
          )}
          <label className="show-totals-toggle" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={showChartTotals}
            onChange={(e) => setShowChartTotals(e.target.checked)}
            disabled={showChartTotalsDisabled}
          />
          Show Totals
        </label>
        </div>
        {(currentDisplayType === "chart" || currentDisplayType === "both") && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => handleDownloadPdf(chartRef, `${chartConfig.name}_Chart`)} className="btn-primary-modern">Download PDF</button>
            <button onClick={handleDownloadPng} className="btn-primary-modern">Download PNG</button>
          </div>
        )}
      </div>
      <div className="chart-display-area">
        {(currentDisplayType === "chart" || currentDisplayType === "both") && (
          <div className="chart-container">
            {getChartComponent()}
          </div>
        )}

        {(currentDisplayType === "table" || currentDisplayType === "both") && chartData.datasets.length > 0 && (
          <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>Year-by-Year Breakdown</h3>
              <div className="table-actions" style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleDownloadPdf(tableRef, `${chartConfig.name}_Table`)} className="btn-primary-modern">Download PDF</button>
                <button onClick={() => handleDownloadCsv(`${chartConfig.name}_Table`)} className="btn-primary-modern">Download CSV</button>
              </div>
            </div>
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
                {chartData.labels.map((year, yearIndex) => {
                  return { year, yearIndex };
                })
                .sort((a, b) => {
                  // Extract numeric year from "Year 2026" format and sort ascending
                  const yearA = parseInt(a.year.toString().replace(/\D/g, '')) || 0;
                  const yearB = parseInt(b.year.toString().replace(/\D/g, '')) || 0;
                  return yearA - yearB;
                })
                .map(({ year, yearIndex }) => (
                  <tr key={year}>
                    <td>{year}</td>
                    {chartData.datasets.map(dataset => (
                      <td key={`${year}-${dataset.label}`}>{formatValue(dataset.data[yearIndex], "currency")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}