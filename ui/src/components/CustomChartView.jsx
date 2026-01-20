import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas'; // Added import for html2canvas
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import CustomChartService from '../services/customChart.service';
import CashFlowService from '../services/cashflow.service';
import AssetService from '../services/asset.service';
import LiabilityService from '../services/liability.service';
import './CustomChartView.css'; // We will create this CSS file

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function CustomChartView({ chartId, assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, onBack, onEdit }) {
  const { userSettings, viewingUserId } = useAuth();
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
  const [hasItemizedSeries, setHasItemizedSeries] = useState(false); // State to track if chart has itemized series
  const [refreshingItemization, setRefreshingItemization] = useState(false); // State for refresh button loading

  const formatValue = useCallback((value, displayType) => {
    if (displayType === 'percentage') {
      return `${(value * 100).toFixed(2)}%`;
    } else { // Default to currency
      return formatCurrency(value);
    }
  }, [formatCurrency]);

  // Helper function to find value in dataPoint for an item
  // Handles both simple keys and dynamic items with LINKED markers
  const findValueInDataPoint = useCallback((itemName, dataPoint, item = null) => {
    const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";
    
    // Try simple key first: "ItemName_Value"
    const simpleKey = `${itemName}_Value`;
    if (dataPoint[simpleKey] !== undefined) {
      let value = dataPoint[simpleKey];
      // Handle -0 (negative zero) - convert to 0 for consistency
      // But preserve actual negative values (expenses are stored as negative in backend)
      if (Object.is(value, -0)) {
        // Check if this is really a -0 (negative zero) or if we should look for actual value
        // If the raw value is exactly -0 and we're dealing with Federal Tax, check if there's an actual tax amount
        if (itemName === FEDERAL_TAX_EXPENSE_DESCRIPTION) {
          // For Federal Tax, -0 might mean the backend stored 0, but let's check the actual numeric value
          // Parse as number to handle any string conversions
          value = Number(value);
          // If it's actually -0, convert to 0; but if it's a real negative number, keep it
          if (value === 0 && Object.is(dataPoint[simpleKey], -0)) {
            // It's truly -0, check if we should read it differently
            // For now, return 0 if it's -0
            return 0;
          }
        } else {
          // For other items, convert -0 to 0
          if (Object.is(value, -0)) {
            return 0;
          }
        }
      }
      // Return the actual value (could be negative for expenses)
      return value;
    }
    
    // For items linked to assets (dividends/interest), try to construct the LINKED format key
    // This handles cases where item.description doesn't match the stored key format
    if (item && item.linked_item_type === "asset" && item.percentage !== null && item.percentage !== undefined) {
      // Try to find linked asset names
      const linkedAssetNames = [];
      if (item.linked_asset_ids && Array.isArray(item.linked_asset_ids) && item.linked_asset_ids.length > 0) {
        // Multi-select: get asset names from assets array (need to find assets from parent context)
        // For now, try single asset lookup first
      } else if (item.linked_item_id) {
        // Single linked asset - we need to find the asset name
        // Try searching all keys that contain the item description and LINKED
        for (const key in dataPoint) {
          if (key.endsWith('_Value') && key.includes(itemName) && key.includes('|LINKED:') && key.includes('|PERCENTAGE:')) {
            const value = dataPoint[key];
            if (Object.is(value, -0)) {
              return 0;
            }
            return value;
          }
        }
      }
    }
    
    // Try to find key that starts with itemName (for dynamic items with LINKED markers)
    // e.g., "ItemName|LINKED:AssetName|PERCENTAGE:10.0_Value"
    for (const key in dataPoint) {
      if (key.endsWith('_Value') && key.startsWith(itemName)) {
        const value = dataPoint[key];
        // Handle -0 (negative zero) - convert to 0 for consistency
        // But keep negative values (expenses are stored as negative in backend)
        if (Object.is(value, -0)) {
          return 0;
        }
        return value;
      }
    }
    
    // Try to find key that contains itemName anywhere (for dynamic items where itemName might be in the middle)
    // This handles cases where the stored key is "ItemName|LINKED:Asset|PERCENTAGE:X_Value"
    for (const key in dataPoint) {
      if (key.endsWith('_Value') && key.includes(itemName) && (key.includes('|LINKED:') || key === `${itemName}_Value`)) {
        const value = dataPoint[key];
        if (Object.is(value, -0)) {
          return 0;
        }
        return value;
      }
    }
    
    // Special case for Federal Income Tax: try to find any key containing the description
    if (itemName === FEDERAL_TAX_EXPENSE_DESCRIPTION) {
      // Try exact constant name
      const federalTaxKey = `${FEDERAL_TAX_EXPENSE_DESCRIPTION}_Value`;
      if (dataPoint[federalTaxKey] !== undefined) {
        const value = dataPoint[federalTaxKey];
        // Handle -0 (negative zero) - convert to 0 for consistency
        if (Object.is(value, -0)) {
          return 0;
        }
        // Federal Tax is stored as negative (expense), return as-is
        return value;
      }
      // Try to find any key containing the description
      for (const key in dataPoint) {
        if (key.includes(FEDERAL_TAX_EXPENSE_DESCRIPTION) && key.endsWith('_Value')) {
          const value = dataPoint[key];
          // Handle -0 (negative zero) - convert to 0 for consistency
          if (Object.is(value, -0)) {
            return 0;
          }
          // Federal Tax is stored as negative (expense), return as-is
          return value;
        }
      }
    }
    
    return 0;
  }, []);

  const getAggregatedValue = useCallback((dataPoint, series) => {
    let sum = 0;
    const targetDataType = series.data_type;
    const targetCategory = series.category;
    const targetLabel = series.label; // Used as fallback when ID doesn't match
    const selectedItemId = series.selected_item_id || series.item_id;

    // Debug logging (disabled by default)
    const DEBUG_MODE = true; // Temporarily enabled to debug Federal Tax issue

    // Get the appropriate array of items based on data type
    let items = [];
    if (targetDataType === 'assets') {
      items = assets;
    } else if (targetDataType === 'liabilities') {
      items = liabilities;
    } else if (targetDataType === 'income') {
      items = incomeItems;
    } else if (targetDataType === 'expenses') {
      items = expenseItems;
    } else {
      return 0;
    }

    // Special handling for amortized liabilities when a specific item is selected
    if (targetDataType === 'liabilities' && selectedItemId) {
      const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
      const selectedItem = items.find(l => (l.id === itemIdNum || l.id === selectedItemId) && l.loan_type === 'amortized');
      if (selectedItem) {
        const value = findValueInDataPoint(selectedItem.name, dataPoint);
        return Math.abs(value);
      }
    }

    // Filter items based on selection criteria
    let filteredItems = items;
    
    // 1. If a specific item is selected (by ID), filter to just that item
    if (selectedItemId && selectedItemId !== "" && selectedItemId !== null && selectedItemId !== 0) {
      const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
      filteredItems = items.filter(item => item.id === itemIdNum || item.id === selectedItemId);
      
      // If ID doesn't match, try to find by label (handles stale IDs from recreated items)
      if (filteredItems.length === 0 && targetLabel) {
        filteredItems = items.filter(item => {
          const itemName = item.description || item.name;
          return itemName === targetLabel;
        });
      }
      
      // If still not found but we have a label, look up value directly from dataPoint
      if (filteredItems.length === 0 && targetLabel) {
        const value = findValueInDataPoint(targetLabel, dataPoint);
        if (value !== 0 || dataPoint[`${targetLabel}_Value`] !== undefined) {
          return targetDataType === 'expenses' ? Math.abs(value) : value;
        }
      }
    }
    // 2. If category is specified, filter by category
    else if (targetCategory && targetCategory !== "") {
      filteredItems = items.filter(item => item.category === targetCategory);
    }
    // 3. Otherwise, include all items of the target data type

    // Iterate through filtered items and sum their values from dataPoint
    filteredItems.forEach(item => {
      const itemName = item.description || item.name;
      const value = findValueInDataPoint(itemName, dataPoint, item);
      
      if (DEBUG_MODE && targetDataType === 'expenses' && itemName === "Federal Income Tax (Calculated)") {
        const exactKey = `${itemName}_Value`;
        const rawValue = dataPoint[exactKey];
        const isNegativeZero = Object.is(rawValue, -0);
        console.log(`DEBUG getAggregatedValue: Federal Tax - itemName: "${itemName}", exactKey: "${exactKey}", value from findValueInDataPoint: ${value}, raw dataPoint[exactKey]:`, rawValue, `(type: ${typeof rawValue}, is -0: ${isNegativeZero}, is negative: ${rawValue < 0})`);
        console.log(`DEBUG getAggregatedValue: Federal Tax - Year: ${dataPoint.Year}, all keys:`, Object.keys(dataPoint));
        // Check all keys containing "Federal" or "Tax"
        const allTaxKeys = Object.keys(dataPoint).filter(k => (k.includes('Federal') || k.includes('Tax')) && k.endsWith('_Value'));
        console.log(`DEBUG getAggregatedValue: Federal Tax - All keys with 'Federal' or 'Tax':`, allTaxKeys);
        allTaxKeys.forEach(key => {
          console.log(`DEBUG getAggregatedValue: Federal Tax - ${key}: ${dataPoint[key]} (type: ${typeof dataPoint[key]}, is negative: ${dataPoint[key] < 0})`);
        });
        // Also check if there's taxable income in the data
        const incomeKeys = Object.keys(dataPoint).filter(k => k.includes('income') && k.endsWith('_Value') && !k.includes('Total'));
        console.log(`DEBUG getAggregatedValue: Federal Tax - Income keys found:`, incomeKeys);
        incomeKeys.forEach(key => {
          console.log(`DEBUG getAggregatedValue: Federal Tax - ${key}: ${dataPoint[key]}`);
        });
      }
      
      // Add the value (expenses are negative, will be converted to positive at the end)
      sum += value;
    });
    
    // If no items found but we have a selectedItemId and label, try direct lookup
    // Find the item first to pass it to findValueInDataPoint for linked items
    let itemForLookup = null;
    if (selectedItemId) {
      const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
      itemForLookup = items.find(item => item.id === itemIdNum || item.id === selectedItemId);
    }
    if (filteredItems.length === 0 && selectedItemId && targetLabel) {
      const directValue = findValueInDataPoint(targetLabel, dataPoint, itemForLookup);
      if (DEBUG_MODE && targetDataType === 'expenses' && targetLabel === "Federal Income Tax (Calculated)") {
        const exactKey = `${targetLabel}_Value`;
        console.log(`DEBUG getAggregatedValue: Federal Tax direct lookup - targetLabel: "${targetLabel}", exactKey: "${exactKey}", directValue: ${directValue}, raw dataPoint[exactKey]:`, dataPoint[exactKey]);
        // Check all keys containing "Federal" or "Tax"
        const allTaxKeys = Object.keys(dataPoint).filter(k => (k.includes('Federal') || k.includes('Tax')) && k.endsWith('_Value'));
        console.log(`DEBUG getAggregatedValue: Federal Tax - All keys with 'Federal' or 'Tax':`, allTaxKeys);
        allTaxKeys.forEach(key => {
          console.log(`DEBUG getAggregatedValue: Federal Tax - ${key}: ${dataPoint[key]}`);
        });
      }
      if (directValue !== 0 || dataPoint[`${targetLabel}_Value`] !== undefined) {
        return targetDataType === 'expenses' ? Math.abs(directValue) : directValue;
      }
    }
    
    // Special fallback for Federal Tax when aggregating all expenses or by category
    // This handles cases where Federal Tax is in data_json but not in expenseItems array
    // Only apply this when we're NOT filtering by a specific item ID (i.e., aggregating multiple items)
    if (targetDataType === 'expenses' && !selectedItemId && filteredItems.length > 0) {
      const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";
      const hasFederalTax = filteredItems.some(item => {
        const itemName = item.description || item.name;
        return itemName === FEDERAL_TAX_EXPENSE_DESCRIPTION;
      });
      // If we're aggregating expenses but Federal Tax is not in the filtered items,
      // but it might be in the data, try to add it
      // This is especially important for "All Expenses" or category-based aggregations
      if (!hasFederalTax) {
        const federalTaxValue = findValueInDataPoint(FEDERAL_TAX_EXPENSE_DESCRIPTION, dataPoint);
        if (federalTaxValue !== 0 || dataPoint[`${FEDERAL_TAX_EXPENSE_DESCRIPTION}_Value`] !== undefined) {
          if (DEBUG_MODE) {
            console.log(`DEBUG getAggregatedValue: Federal Tax fallback - found value ${federalTaxValue} for year ${dataPoint.Year}, adding to sum`);
          }
          sum += federalTaxValue;
        }
      }
    }

    // Special handling for expenses and liabilities to display as positive values
    if (targetDataType === 'expenses' || (targetDataType === 'liabilities' && sum < 0)) {
      return Math.abs(sum);
    }
    return sum;
  }, [assets, liabilities, incomeItems, expenseItems, findValueInDataPoint]);

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
        // Also check if chart has itemized series (series with selected_item_id)
        try {
          const seriesConfigurations = JSON.parse(fetchedConfig.series_configurations);
          const dataTypes = seriesConfigurations.map(s => s.data_type);
          const uniqueDataTypes = [...new Set(dataTypes)];
          const hasMultipleDataTypes = uniqueDataTypes.length > 1;
          setShowChartTotalsDisabled(hasMultipleDataTypes);
          if (hasMultipleDataTypes) {
            setShowChartTotals(false); // Automatically uncheck if multiple data types
          }
          
          // Check if any series has selected_item_id (itemized series)
          // OR if any series has a label that might be from a deleted item (stale itemization)
          // OR if there are duplicate series (same data_type + category) that should be consolidated
          const hasItemized = seriesConfigurations.some(s => {
            const hasItemId = (s.selected_item_id || s.item_id) && (s.selected_item_id !== null && s.selected_item_id !== "" && s.selected_item_id !== 0);
            // Also check if label doesn't match category/data type defaults (might be stale item name)
            const labelMatchesDefault = s.label === s.category || 
                                       s.label === (s.data_type ? s.data_type.charAt(0).toUpperCase() + s.data_type.slice(1) : null) ||
                                       s.label === 'All Categories' ||
                                       s.label === 'All Items';
            return hasItemId || (!labelMatchesDefault && s.label && s.data_type);
          });
          
          // Check for duplicate series (same data_type + category + not itemized) - these should be consolidated
          const hasDuplicates = (() => {
            const seen = new Map();
            return seriesConfigurations.some(s => {
              const selectedItemId = s.selected_item_id || s.item_id;
              const isItemized = selectedItemId && selectedItemId !== "" && selectedItemId !== null && selectedItemId !== 0;
              if (isItemized) return false; // Don't count itemized series as duplicates
              
              const key = `${s.data_type}_${s.category || ''}`;
              if (seen.has(key)) {
                return true; // Found a duplicate
              }
              seen.set(key, true);
              return false;
            });
          })();
          
          setHasItemizedSeries(hasItemized || hasDuplicates);
        } catch (e) {
          console.error("Error parsing series configurations for totals check:", e);
          setHasItemizedSeries(false);
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

  // Function to refresh itemization - un-itemizes and re-itemizes all itemized series
  // This causes the backend to re-expand itemized series with all current items (including newly created ones)
  const handleRefreshItemization = async () => {
    if (!chartConfig) return;
    
    setRefreshingItemization(true);
    setMessage('');
    
    try {
      // Parse series configurations
      const seriesConfigurations = JSON.parse(chartConfig.series_configurations);
      
      // Refresh itemization: re-match itemized series to current items by ID or name
      // This preserves the itemization (which items are shown) but updates IDs/labels if items changed
      const updatedSeries = seriesConfigurations.map(series => {
        const selectedItemId = series.selected_item_id || series.item_id;
        const isItemized = selectedItemId && selectedItemId !== "" && selectedItemId !== null && selectedItemId !== 0;
        const isItemizedFlag = series.itemize === true;
        
        // Only process itemized series (those with item IDs or itemize flag)
        // Non-itemized series (showing all items) should remain unchanged
        if (!isItemized && !isItemizedFlag) {
          return series; // Keep non-itemized series as-is
        }
        
        // Get the appropriate array of items based on data type
        let items = [];
        if (series.data_type === 'assets') {
          items = assets;
        } else if (series.data_type === 'liabilities') {
          items = liabilities;
        } else if (series.data_type === 'income') {
          items = incomeItems;
        } else if (series.data_type === 'expenses') {
          items = expenseItems;
        } else {
          return series; // Unknown data type, keep as-is
        }
        
        // Try to find item by ID first
        let foundItem = null;
        if (isItemized) {
          const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
          foundItem = items.find(item => item.id === itemIdNum || item.id === selectedItemId);
        }
        
        // If not found by ID, try to find by label/name
        if (!foundItem && series.label) {
          foundItem = items.find(item => {
            const itemName = item.description || item.name;
            return itemName === series.label;
          });
        }
        
        // If item was found, update the ID and label (preserve itemization)
        if (foundItem) {
          const currentItemName = foundItem.description || foundItem.name;
          return {
            ...series,
            selected_item_id: foundItem.id,
            item_id: foundItem.id,
            label: currentItemName,
            itemize: true, // Ensure itemize flag is set
          };
        }
        
        // Item not found - keep the series but update label to indicate item is missing
        // Don't un-itemize it, as the user may want to keep it configured for when the item is recreated
        let newLabel = series.label || 'Item Not Found';
        if (series.category) {
          newLabel = `${series.category} (Item Not Found)`;
        } else if (series.data_type) {
          newLabel = `${series.data_type.charAt(0).toUpperCase() + series.data_type.slice(1)} (Item Not Found)`;
        }
        
        return {
          ...series,
          label: newLabel,
          // Keep selected_item_id and itemize flag - don't clear them
        };
      });
      
      // Use updated series (preserving itemization)
      const finalSeries = updatedSeries;
      
      // Check if series configurations actually changed in a meaningful way
      // (only IDs/labels changed, but same items are still being displayed)
      const originalSeriesStr = JSON.stringify(seriesConfigurations);
      const finalSeriesStr = JSON.stringify(finalSeries);
      
      // If only item IDs/labels changed but the actual items are the same,
      // we can update the chart config without triggering a recalculation
      // by comparing the actual data being displayed (not just the IDs)
      let needsUpdate = false;
      if (originalSeriesStr !== finalSeriesStr) {
        // Check if the change is only in IDs/labels (same items, different IDs)
        // If items were added/removed, we do need to recalculate
        const originalItemCounts = {};
        const finalItemCounts = {};
        
        seriesConfigurations.forEach(s => {
          const key = `${s.data_type}_${s.category || 'all'}_${s.selected_item_id || s.item_id || 'unitemized'}`;
          originalItemCounts[key] = (originalItemCounts[key] || 0) + 1;
        });
        
        finalSeries.forEach(s => {
          const key = `${s.data_type}_${s.category || 'all'}_${s.selected_item_id || s.item_id || 'unitemized'}`;
          finalItemCounts[key] = (finalItemCounts[key] || 0) + 1;
        });
        
        // Compare counts to see if same items are being displayed
        const originalKeys = Object.keys(originalItemCounts).sort().join(',');
        const finalKeys = Object.keys(finalItemCounts).sort().join(',');
        needsUpdate = originalKeys !== finalKeys; // Only update if items changed, not just IDs
      }
      
      // Always update the series configurations
      // Use skip_recalculate flag to avoid triggering recalculation if only IDs/labels changed
      const updatedConfig = {
        ...chartConfig,
        series_configurations: JSON.stringify(finalSeries),
        skip_recalculate: !needsUpdate, // Skip recalculation if only IDs/labels changed
      };
      
      await CustomChartService.update(chartId, updatedConfig);
      
      if (needsUpdate) {
        setMessage('Itemization refreshed. Chart has been recalculated with updated items.');
      } else {
        setMessage('Itemization refreshed. Itemized series have been re-matched to current items. Chart uses existing projection data.');
      }
      
      // Reload the chart to reflect the changes
      const response = await CustomChartService.get(chartId);
      const fetchedConfig = response.data;
      setChartConfig(fetchedConfig);
      
      // Update hasItemizedSeries state based on whether any series are itemized
      const hasItemized = finalSeries.some(s => {
        const itemId = s.selected_item_id || s.item_id;
        return (itemId && itemId !== "" && itemId !== null && itemId !== 0) || s.itemize === true;
      });
      setHasItemizedSeries(hasItemized);
      
      prepareChartData(fetchedConfig);
      
      // Clear message after 5 seconds
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error("Error refreshing itemization:", error);
      setMessage(`Failed to refresh itemization: ${error.response?.data?.detail || error.message}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setRefreshingItemization(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading chart...</div>;
  }

  return (
    <div className="custom-chart-view-container">
      <button onClick={onBack} className="back-btn">← Back to Custom Charts and Tables</button>
      {message && (
        <div className={`message ${message.includes('error') || message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`} style={{ marginBottom: '15px' }}>
          {message}
        </div>
      )}
      <div className="chart-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onEdit && (
            <button onClick={() => onEdit(chartId)} className="btn-primary-modern">Edit</button>
          )}
          {hasItemizedSeries && (
            <button 
              onClick={handleRefreshItemization} 
              className="btn-primary-modern"
              disabled={refreshingItemization}
              title="Refresh itemization - removes all itemization and re-matches series to current items by name. Items not found will be un-itemized."
            >
              {refreshingItemization ? 'Refreshing...' : 'Refresh Itemization'}
            </button>
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