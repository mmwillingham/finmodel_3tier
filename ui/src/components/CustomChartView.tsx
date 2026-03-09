import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas'; // Added import for html2canvas
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { FormControlLabel, Slider, Switch } from "@mui/material";
import CustomChartService from '../services/customChart.service';
import { projectionSwitchSx } from "../utils/projectionUiStyles";
import { createDarkLineChartOptions, createDarkPieChartOptions } from "../utils/darkChartTheme";
import CashFlowService from '../services/cashflow.service';
import AssetService from '../services/asset.service';
import LiabilityService from '../services/liability.service';
import './CustomChartView.css'; // We will create this CSS file

type FinancialRecord = Record<string, any>;
type DataPoint = Record<string, any>;

interface SeriesConfiguration {
  label: string;
  color: string;
  data_type: string;
  category?: string;
  selected_item_id?: string | number | null;
  item_id?: string | number | null;
}

interface ChartConfigRecord {
  name: string;
  chart_type: string;
  data_json: string;
  series_configurations: string;
  display_type?: string;
  x_axis_label?: string;
  y_axis_label?: string;
}

interface ChartDatasetRecord {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: any;
  fill?: boolean;
  tension?: number;
  borderWidth?: number;
  pointRadius?: number;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
  pointHoverRadius?: number;
  pointHoverBackgroundColor?: string;
  pointHoverBorderColor?: string;
  borderDash?: number[];
}

interface ChartDataRecord {
  labels: Array<string | number>;
  datasets: ChartDatasetRecord[];
}

interface CustomChartViewProps {
  chartId: string | number | null;
  assets: FinancialRecord[];
  liabilities: FinancialRecord[];
  incomeItems: FinancialRecord[];
  expenseItems: FinancialRecord[];
  projectionYears: number;
  formatCurrency: (value: number) => string;
  onBack: () => void;
  onEdit?: (chartId: string | number | null) => void;
  showProjectionYearSelector?: boolean;
  onProjectionYearsChange?: (years: number) => void;
  maxProjectionYears?: number;
  isLimitedPlan?: boolean;
}

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function CustomChartView({ chartId, assets, liabilities, incomeItems, expenseItems, projectionYears, formatCurrency, onBack, onEdit, showProjectionYearSelector = false, onProjectionYearsChange, maxProjectionYears, isLimitedPlan = false }: CustomChartViewProps) {
  const { userSettings, viewingUserId } = useAuth();
  const [chartConfig, setChartConfig] = useState<ChartConfigRecord | null>(null);
  const [chartData, setChartData] = useState<ChartDataRecord>({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const chartRef = useRef<any>(null);
  const tableRef = useRef<any>(null); // New ref for the table
  const currentYear = new Date().getFullYear();
  const [showChartTotals, setShowChartTotals] = useState(false); // State for individual chart totals
  const [showChartTotalsDisabled, setShowChartTotalsDisabled] = useState(false); // State to disable totals checkbox when data types differ
  const [currentDisplayType, setCurrentDisplayType] = useState("chart"); // New state for display type (chart, table, or both)
  const [hasItemizedSeries, setHasItemizedSeries] = useState(false); // State to track if chart has itemized series
  const [sliderProjectionYears, setSliderProjectionYears] = useState(projectionYears ?? 30);

  useEffect(() => {
    setSliderProjectionYears(projectionYears ?? 30);
  }, [projectionYears]);

  const formatValue = useCallback((value: number, displayType: string): string => {
    if (displayType === 'percentage') {
      return `${(value * 100).toFixed(2)}%`;
    } else { // Default to currency
      return formatCurrency(value);
    }
  }, [formatCurrency]);

  // Helper function to find value in dataPoint for an item
  // Handles both simple keys and dynamic items with LINKED markers
  const findValueInDataPoint = useCallback((itemName: string, dataPoint: DataPoint, item: FinancialRecord | null = null): number => {
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
      const linkedAssetNames: string[] = [];
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

  const getAggregatedValue = useCallback((dataPoint: DataPoint, series: SeriesConfiguration): number => {
    let sum = 0;
    const targetDataType = series.data_type;
    const targetCategory = series.category;
    const targetLabel = series.label; // Used as fallback when ID doesn't match
    const selectedItemId = series.selected_item_id || series.item_id;

    // Debug logging (disabled by default)

    // Get the appropriate array of items based on data type
    let items: FinancialRecord[] = [];
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
      const selectedItem = items.find((l: FinancialRecord) => (l.id === itemIdNum || l.id === selectedItemId) && l.loan_type === 'amortized');
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
      filteredItems = items.filter((item: FinancialRecord) => item.id === itemIdNum || item.id === selectedItemId);
      
      // If ID doesn't match, try to find by label (handles stale IDs from recreated items)
      if (filteredItems.length === 0 && targetLabel) {
        filteredItems = items.filter((item: FinancialRecord) => {
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
      filteredItems = items.filter((item: FinancialRecord) => item.category === targetCategory);
    }
    // 3. Otherwise, include all items of the target data type

    // Iterate through filtered items and sum their values from dataPoint
    filteredItems.forEach((item: FinancialRecord) => {
      const itemName = item.description || item.name;
      const value = findValueInDataPoint(itemName, dataPoint, item);
      
      
      // Add the value (expenses are negative, will be converted to positive at the end)
      sum += value;
    });
    
    // If no items found but we have a selectedItemId and label, try direct lookup
    // Find the item first to pass it to findValueInDataPoint for linked items
    let itemForLookup = null;
    if (selectedItemId) {
      const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
      itemForLookup = items.find((item: FinancialRecord) => item.id === itemIdNum || item.id === selectedItemId);
    }
    if (filteredItems.length === 0 && selectedItemId && targetLabel) {
      const directValue = findValueInDataPoint(targetLabel, dataPoint, itemForLookup);
      if (directValue !== 0 || dataPoint[`${targetLabel}_Value`] !== undefined) {
        return targetDataType === 'expenses' ? Math.abs(directValue) : directValue;
      }
    }
    
    // Special fallback for Federal Tax when aggregating all expenses or by category
    // This handles cases where Federal Tax is in data_json but not in expenseItems array
    // Only apply this when we're NOT filtering by a specific item ID (i.e., aggregating multiple items)
    if (targetDataType === 'expenses' && !selectedItemId && filteredItems.length > 0) {
      const FEDERAL_TAX_EXPENSE_DESCRIPTION = "Federal Income Tax (Calculated)";
      const hasFederalTax = filteredItems.some((item: FinancialRecord) => {
        const itemName = item.description || item.name;
        return itemName === FEDERAL_TAX_EXPENSE_DESCRIPTION;
      });
      // If we're aggregating expenses but Federal Tax is not in the filtered items,
      // but it might be in the data, try to add it
      // This is especially important for "All Expenses" or category-based aggregations
      if (!hasFederalTax) {
        const federalTaxValue = findValueInDataPoint(FEDERAL_TAX_EXPENSE_DESCRIPTION, dataPoint);
        if (federalTaxValue !== 0 || dataPoint[`${FEDERAL_TAX_EXPENSE_DESCRIPTION}_Value`] !== undefined) {
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

  const prepareChartData = useCallback((fetchedConfig: ChartConfigRecord) => {
    let parsedDataJson: DataPoint[] = [];
    try {
      parsedDataJson = JSON.parse(fetchedConfig.data_json);
    } catch (e: any) {
      setMessage("Error processing chart data from the server.");
      setChartData({ labels: [], datasets: [] });
      return;
    }

    if (!Array.isArray(parsedDataJson) || parsedDataJson.length === 0) {
      setMessage("No data available for the chart from server response.");
      setChartData({ labels: [], datasets: [] });
      return;
    }

    const requestedProjectionYears = Number.isFinite(Number(projectionYears))
      ? Math.max(0, Number(projectionYears))
      : null;

    // Apply projection-years window to chart/table output so slider changes
    // immediately affect displayed points/rows for custom charts.
    const filteredDataJson = requestedProjectionYears === null
      ? parsedDataJson
      : parsedDataJson.filter((dataPoint: DataPoint) => {
          const parsedYear = parseInt(String(dataPoint.Year).replace(/\D/g, ''), 10);
          if (Number.isNaN(parsedYear)) {
            return true;
          }
          return parsedYear >= currentYear && parsedYear <= (currentYear + requestedProjectionYears);
        });

    const effectiveDataJson = filteredDataJson.length > 0 ? filteredDataJson : parsedDataJson;
    const labels = effectiveDataJson.map((dataPoint: DataPoint) => dataPoint.Year);
    let datasets: ChartDatasetRecord[] = [];

    try {
      const seriesConfigurations = JSON.parse(fetchedConfig.series_configurations) as SeriesConfiguration[];
      seriesConfigurations.forEach((series: SeriesConfiguration) => {

        const dataValues = effectiveDataJson.map((dataPoint: DataPoint) => {
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
        const totalDataValues = labels.map((_: any, yearIndex: any) => {
          let sum = 0;
          datasets.forEach((dataset: ChartDatasetRecord) => {
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

    } catch (e: any) {
      setMessage("Error preparing chart data.");
      datasets = []; // Ensure datasets is empty on error
    }

    setChartData({ labels, datasets });
  }, [showChartTotals, getAggregatedValue, assets, liabilities, incomeItems, expenseItems, projectionYears, currentYear]); // Added all necessary dependencies

  useEffect(() => {
    const fetchAndPrepareChart = async () => {
      setLoading(true);
      setMessage('');
      try {
        const response = await CustomChartService.get(String(chartId));
        const fetchedConfig = response.data;
        setChartConfig(fetchedConfig);
        setCurrentDisplayType(fetchedConfig.display_type || "chart"); // Set display type from fetched config
        try {
          const parsedDataJson = JSON.parse(fetchedConfig.data_json);
        } catch (parseError) {
        }
        // Check if series have different data types - if so, disable totals
        // Also check if chart has itemized series (series with selected_item_id)
        try {
          const seriesConfigurations = JSON.parse(fetchedConfig.series_configurations);
          const dataTypes = seriesConfigurations.map((s: SeriesConfiguration) => s.data_type);
          const uniqueDataTypes = [...new Set(dataTypes)];
          const hasMultipleDataTypes = uniqueDataTypes.length > 1;
          setShowChartTotalsDisabled(hasMultipleDataTypes);
          if (hasMultipleDataTypes) {
            setShowChartTotals(false); // Automatically uncheck if multiple data types
          }
          
          // Check if any series has selected_item_id (itemized series)
          // OR if any series has a label that might be from a deleted item (stale itemization)
          // OR if there are duplicate series (same data_type + category) that should be consolidated
          const hasItemized = seriesConfigurations.some((s: SeriesConfiguration) => {
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
            return seriesConfigurations.some((s: SeriesConfiguration) => {
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
        } catch (e: any) {
          setHasItemizedSeries(false);
        }
        prepareChartData(fetchedConfig); // Call the memoized function
      } catch (error: any) {
        setMessage("Failed to load chart configuration.");
      } finally {
        setLoading(false);
      }
    };

    if (chartId) {
      fetchAndPrepareChart();
    }

    // Listen for chart recalculation events
    const handleChartRecalculated = (event: Event) => {
      const typedEvent = event as CustomEvent<{ chartId?: string | number }>;
      const recalculatedChartId = typedEvent.detail?.chartId;
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

    const chartTitle = `${chartConfig.name}${userSettings?.person1_first_name && userSettings?.person1_last_name ? ` - ${userSettings.person1_first_name} ${userSettings.person1_last_name}` : ''}`;
    const options: any = chartConfig.chart_type === 'pie'
      ? createDarkPieChartOptions({
          title: chartTitle,
          legendPosition: 'top',
          formatValue: formatCurrency,
        })
      : {
          ...createDarkLineChartOptions({
            title: chartTitle,
            xAxisTitle: chartConfig.x_axis_label || "End of Year",
            beginAtZero: true,
          }),
          scales: {
            x: {
              ...createDarkLineChartOptions().scales.x,
              title: {
                display: !!chartConfig.x_axis_label,
                text: chartConfig.x_axis_label || "",
                color: "#94a3b8",
              },
            },
            y: {
              ...createDarkLineChartOptions().scales.y,
              beginAtZero: true,
              title: {
                display: !!chartConfig.y_axis_label,
                text: chartConfig.y_axis_label || "",
                color: "#94a3b8",
              },
              ticks: {
                color: "#94a3b8",
                callback: function(value: number | string) {
                  return formatValue(Number(value) || 0, "currency");
                }
              }
            },
          },
        };

    switch (chartConfig.chart_type) {
      case 'line':
        return <Line ref={chartRef} data={chartData as any} options={options as any} />;
      case 'bar':
        return <Bar ref={chartRef} data={chartData as any} options={options as any} />;
      case 'pie':
        // For pie charts, we don't have a "sum of lines" concept, as it's a single point in time aggregate.
        // The `showChartTotals` will not apply to pie charts in this context.
        const pieLabels = chartData.datasets.map((ds: any) => ds.label);
        const pieDataValues = chartData.datasets.map((ds: ChartDatasetRecord) => ds.data.reduce((sum: number, val: number) => sum + val, 0)); // Sum all values for pie
        const pieBackgroundColors = chartData.datasets.map((ds: any) => ds.backgroundColor);
        const pieBorderColors = chartData.datasets.map((ds: any) => ds.borderColor);

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
          options={options as any} // Use the consolidated options object
        />;
      default:
        return <p>Unsupported chart type: ${chartConfig.chart_type}</p>;
    }
  };

  const handleDownloadCsv = (filename: string) => {
    if (chartData.datasets.length === 0) {
      return;
    }

    const headerRow = ["Year", ...chartData.datasets.map((d: any) => d.label)];
    const csvRows = [headerRow.join(',')];

    chartData.labels.forEach((year: string | number, yearIndex: number) => {
      const row: Array<string | number> = [year];
      chartData.datasets.forEach((dataset: ChartDatasetRecord) => {
        row.push(dataset.data[yearIndex] ?? 0);
      });
      csvRows.push(row.join(','));
    });

    let csvString = '';
    csvRows.forEach((row: any, index: any) => {
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
      link.download = `${(chartConfig?.name || 'chart').replace(/\s/g, '_')}.png`;
      link.href = chartRef.current.toBase64Image('image/png', 1);
      link.click();
    } else {
      setMessage("Error: Chart not ready for download.");
    }
  };

  const handleDownloadPdf = async (ref: React.RefObject<any>, filename: string) => {
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
      setMessage("Error: Element not ready for download.");
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
      {showProjectionYearSelector && (
        <div style={{ margin: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
          <label htmlFor="custom-chart-years" style={{ fontWeight: 600 }}>
            Projection Years: <strong>{sliderProjectionYears}</strong>
          </label>
          <Slider
            id="custom-chart-years"
            size="small"
            min={0}
            max={maxProjectionYears ?? 50}
            step={1}
            value={sliderProjectionYears}
            valueLabelDisplay="auto"
            onChange={(_: any, value: any) => setSliderProjectionYears(Number(value))}
            onChangeCommitted={(_: any, value: any) => onProjectionYearsChange?.(Number(value))}
          />
          {isLimitedPlan && maxProjectionYears !== undefined && (
            <span style={{ fontSize: '0.85em', color: '#666' }}>
              Free plan max {maxProjectionYears} years. <a href="/pricing">Upgrade</a>
            </span>
          )}
        </div>
      )}
      <div className="chart-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onEdit && (
            <button onClick={() => onEdit(chartId)} className="btn-primary-modern">Edit</button>
          )}
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Switch
                sx={projectionSwitchSx}
                checked={showChartTotals}
                onChange={(e: any) => setShowChartTotals(e.target.checked)}
                disabled={showChartTotalsDisabled}
              />
            }
            label="Show Totals"
          />
        </div>
        {(currentDisplayType === "chart" || currentDisplayType === "both") && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => handleDownloadPdf(chartRef, `${chartConfig?.name || 'chart'}_Chart`)} className="btn-primary-modern">Download PDF</button>
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
                <button onClick={() => handleDownloadPdf(tableRef, `${chartConfig?.name || 'chart'}_Table`)} className="btn-primary-modern">Download PDF</button>
                <button onClick={() => handleDownloadCsv(`${chartConfig?.name || 'chart'}_Table`)} className="btn-primary-modern">Download CSV</button>
              </div>
            </div>
            <div className="table-scroll">
              <table ref={tableRef} className="custom-chart-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    {chartData.datasets.map((dataset: ChartDatasetRecord) => (
                      <th key={dataset.label}>{dataset.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.labels.map((year: any, yearIndex: any) => {
                    return { year, yearIndex };
                  })
                  .sort((a: any, b: any) => {
                  // Extract numeric year from "Year 2026" format and sort ascending
                  const yearA = parseInt(a.year.toString().replace(/\D/g, '')) || 0;
                  const yearB = parseInt(b.year.toString().replace(/\D/g, '')) || 0;
                  return yearA - yearB;
                })
                .map(({ year, yearIndex }) => (
                  <tr key={year}>
                    <td>{year}</td>
                    {chartData.datasets.map((dataset: ChartDatasetRecord) => (
                      <td key={`${year}-${dataset.label}`}>{formatValue(dataset.data[yearIndex], "currency")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}