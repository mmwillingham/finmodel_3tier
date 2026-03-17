import React, { useState, useEffect, useRef } from 'react';
import { FormControlLabel, Switch } from "@mui/material";
import CustomChartService from '../services/customChart.service';
import { projectionSwitchSx } from "../utils/projectionUiStyles";
import './CustomChartForm.css'; // We will create this CSS file

const chartTypes = ["line", "bar", "pie"];
const dataSourcesOptions = ["assets", "liabilities", "income", "expenses"];
const dataTypeOptions = ["assets", "liabilities", "income", "expenses"];
const aggregationOptions = ["sum", "average", "count"];

interface DataItem {
  id: string | number;
  name?: string;
  description?: string;
  category?: string;
  account_id?: string | number | null;
  [key: string]: any;
}

interface AccountItem {
  id: string | number;
  brokerage?: string;
  account_name?: string;
  [key: string]: any;
}

interface SeriesConfiguration {
  data_type: string;
  field: string;
  aggregation: string;
  label: string;
  color: string;
  category: string;
  selected_item_id: string | number | null;
  selected_account_ids: Array<string | number>;
  include_selected_assets?: boolean;
  itemize?: boolean;
  item_id?: string | number | null;
  [key: string]: any;
}

interface CustomChartFormProps {
  chartId?: string | number | null;
  onChartSaved: () => void;
  onCancel: () => void;
  assets: DataItem[];
  liabilities: DataItem[];
  incomeItems: DataItem[];
  expenseItems: DataItem[];
  projectionYears?: number;
  assetCategories: string[];
  liabilityCategories: string[];
  incomeCategories: string[];
  expenseCategories: string[];
  accounts?: AccountItem[];
}

// Helper to generate a random color
const getRandomColor = () => {
  const randomHex = Math.floor(Math.random() * 16777215).toString(16);
  return "#" + ("000000" + randomHex).slice(-6);
};

const getDataSourceItemOptions = (
  dataType: string,
  assets: DataItem[],
  liabilities: DataItem[],
  incomeItems: DataItem[],
  expenseItems: DataItem[],
  selectedCategory: string,
  selectedAccountIds: Array<string | number> = []
) => {
  let items: DataItem[] = [];
  switch (dataType) {
    case 'assets': items = assets; break;
    case 'liabilities': items = liabilities; break;
    case 'income': items = incomeItems; break;
    case 'expenses': items = expenseItems; break;
    default: return [];
  }

  // Filter by category if a specific category is selected
  if (selectedCategory) {
    items = items.filter((item: DataItem) => item.category === selectedCategory);
  }

  // Filter by account if accounts are selected (only for assets which have account_id)
  // When accounts are selected, show ONLY assets that belong to those accounts
  // When NO accounts are selected, show ALL assets (no filtering)
  if (dataType === 'assets' && selectedAccountIds && selectedAccountIds.length > 0) {
    items = items.filter((item: DataItem) => {
      // Include assets that belong to one of the selected accounts
      // This means if an asset has an account_id, it must match one of the selected accounts
      // Assets without account_id are excluded when accounts are selected (they would show when no accounts are selected)
      return item.account_id && selectedAccountIds.includes(item.account_id);
    });
  }
  // When selectedAccountIds is empty or not provided, show ALL assets (no filtering)

  // Map to a consistent format for options
  return items.map((item: DataItem) => ({
    id: item.id,
    name: item.name || item.description, // Assets/Liabilities have 'name', CashFlowItems have 'description'
    category: item.category,
    account_id: item.account_id || null,
  }));
};

export default function CustomChartForm({
  chartId,
  onChartSaved,
  onCancel,
  assets,
  liabilities,
  incomeItems,
  expenseItems,
  projectionYears,
  assetCategories,
  liabilityCategories,
  incomeCategories,
  expenseCategories,
  accounts = [],
}: CustomChartFormProps) {
  const [name, setName] = useState("");
  const [chartType, setChartType] = useState(chartTypes[0]);
  const [displayType, setDisplayType] = useState("chart"); // New state for display type
  const [selectedDataSources, setSelectedDataSources] = useState(dataSourcesOptions); // Initialize with all options selected
  const [seriesConfigurations, setSeriesConfigurations] = useState<SeriesConfiguration[]>([]);
  const [xAxisLabel, setXAxisLabel] = useState("Year");
  const [yAxisLabel, setYAxisLabel] = useState("Value");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [removingItemization, setRemovingItemization] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chartId) {
      // Editing existing chart
      setLoading(true);
      CustomChartService.get(String(chartId))
        .then((response: any) => {
          const chart = response.data;
          setName(chart.name);
          setChartType(chart.chart_type);
          setDisplayType(chart.display_type || "chart"); // Set display type from fetched config
          setSelectedDataSources(chart.data_sources ? chart.data_sources.split(',') : []);
        const parsedSeries = JSON.parse(chart.series_configurations);
        setSeriesConfigurations(parsedSeries.map((series: Record<string, any>) => ({
          ...series, 
          category: series.category || '', 
          selected_item_id: series.selected_item_id || null,
          selected_account_ids: series.selected_account_ids || [], // Load account filter if present
          include_selected_assets: series.include_selected_assets ?? ((series.selected_account_ids || []).length > 0),
          itemize: series.itemize || false, // Load itemize flag if present
        })));
          setXAxisLabel(chart.x_axis_label || "");
          setYAxisLabel(chart.y_axis_label || "");
        })
        .catch((_error: any) => {
          setMessage("Failed to load chart data.");
        })
        .finally(() => setLoading(false));
    } else {
      // Reset form for new chart, ensure all data sources are selected by default
      setName("");
      setChartType(chartTypes[0]);
      setDisplayType("chart"); // Reset for new chart
      setSelectedDataSources(dataSourcesOptions); // Ensure all are selected for new charts
      setSeriesConfigurations([]);
      setXAxisLabel("Year");
      setYAxisLabel("Value");
    }
  }, [chartId]);

  const handleDataSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedDataSources((prev: any) => [...prev, value]);
    } else {
      setSelectedDataSources((prev: any) => prev.filter((source: any) => source !== value));
    }
  };

  const handleAddSeries = () => {
    // Always use first data source option (assets) as default when adding a new series
    const defaultDataType = dataSourcesOptions[0];
    // Set default label to capitalized data type name
    const defaultLabel = defaultDataType ? defaultDataType.charAt(0).toUpperCase() + defaultDataType.slice(1) : "";
    setSeriesConfigurations((prev: any) => [...prev, {
      data_type: defaultDataType,
      field: "value", // Default field, will need to be dynamic later
      aggregation: "sum",
      label: defaultLabel, // Initialize with capitalized data type name
      color: getRandomColor(),
      category: "", // New category field
      selected_item_id: null, // Initialize selected_item_id
      selected_account_ids: [], // Initialize account filter
      include_selected_assets: false, // Keep list hidden by default
      itemize: false, // Initialize itemize flag
    }]);
  };

  const handleSeriesChange = (index: number, field: string, value: any) => {
    const newSeries = [...seriesConfigurations];
    (newSeries[index] as Record<string, any>)[field] = value;
    // Reset category, selected_item_id, and selected_account_ids if data_type changes
    if (field === 'data_type') {
      newSeries[index].category = '';
      newSeries[index].selected_item_id = null;
      newSeries[index].selected_account_ids = [];
      newSeries[index].include_selected_assets = false;
      // Set default label to data type name (capitalized) when only data type is selected
      const dataTypeLabel = value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
      newSeries[index].label = dataTypeLabel;
    }
    
    // Handle account multi-select changes
    if (field === 'selected_account_ids') {
      newSeries[index].selected_account_ids = value || [];
    }
    if (field === 'include_selected_assets' && !value) {
      // Turning off selector means include all asset accounts.
      newSeries[index].selected_account_ids = [];
    }
    // Reset selected_item_id if category changes, and set default label to category
    if (field === 'category') {
      newSeries[index].selected_item_id = null;
      // Set label to category value if category is selected
      if (value) {
        newSeries[index].label = value;
      } else {
        newSeries[index].label = 'All Categories'; // Set label to "All Categories" if "All Categories" is selected
      }
    }
    // Set label to item name when selected_item_id changes
    if (field === 'selected_item_id') {
      if (value && value !== "" && value !== null && value !== 0) {
        const currentSeriesDataType = newSeries[index].data_type;
        const options = getDataSourceItemOptions(
          currentSeriesDataType,
          assets,
          liabilities,
          incomeItems,
          expenseItems,
          newSeries[index].category,
          newSeries[index].selected_account_ids || []
        );
        const selectedItem = options.find((item: DataItem) => {
          const itemId = String(item.id);
          const valueId = String(value);
          return itemId === valueId;
        });
        if (selectedItem) {
          newSeries[index].label = selectedItem.name || 'All Items';
        } else {
          // Fallback: set label to category or default
          if (newSeries[index].category) {
            newSeries[index].label = newSeries[index].category;
          } else {
            newSeries[index].label = 'All Items';
          }
        }
      } else {
        // No item selected - reset label to category or data type default
        if (newSeries[index].category) {
          newSeries[index].label = newSeries[index].category;
        } else if (newSeries[index].data_type) {
          // Default to capitalized data type name
          const dataTypeLabel = newSeries[index].data_type.charAt(0).toUpperCase() + newSeries[index].data_type.slice(1);
          newSeries[index].label = dataTypeLabel;
        } else {
          newSeries[index].label = 'All Categories';
        }
      }
    }
    setSeriesConfigurations(newSeries);
  };

  const handleRemoveSeries = (index: number) => {
    setSeriesConfigurations((prev: any) => prev.filter((_: any, i: any) => i !== index));
  };

  const toggleSelectedAccount = (seriesIndex: number, accountId: string | number) => {
    const currentSelected = seriesConfigurations[seriesIndex].selected_account_ids || [];
    const nextSelected = currentSelected.includes(accountId)
      ? currentSelected.filter((id: string | number) => id !== accountId)
      : [...currentSelected, accountId];
    handleSeriesChange(seriesIndex, 'selected_account_ids', nextSelected);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const chartData = {
      name,
      chart_type: chartType,
      display_type: displayType, // Include new display type
      data_sources: dataSourcesOptions.join(','), // Always use all data sources
      series_configurations: JSON.stringify(seriesConfigurations),
      x_axis_label: xAxisLabel,
      y_axis_label: yAxisLabel,
    };

    try {
      if (chartId) {
        await CustomChartService.update(String(chartId), chartData);
        setMessage("Chart updated successfully!");
      } else {
        await CustomChartService.create(chartData);
        setMessage("Chart created successfully!");
      }
      onChartSaved();
    } catch (error: any) {
      setMessage("Failed to save chart: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Fix scrolling issue in Chrome: prevent form elements from capturing wheel events
  // Chrome-specific issue: form elements capture wheel events even when they can't scroll
  // The issue manifests as needing to move mouse slightly before scrolling works
  // Solution: Use window-level wheel handler that only activates when hovering over form elements
  useEffect(() => {
    const formContainer = formRef.current;
    if (!formContainer) return;

    const mainContent = formContainer.closest('.main-content') as HTMLElement | null;
    if (!mainContent) return;

    let isHoveringForm = false;

    // Track when mouse enters/leaves form container
    const handleMouseEnter = () => {
      isHoveringForm = true;
    };
    const handleMouseLeave = () => {
      isHoveringForm = false;
    };

    formContainer.addEventListener('mouseenter', handleMouseEnter);
    formContainer.addEventListener('mouseleave', handleMouseLeave);

    // Window-level wheel handler that intercepts when hovering over form
    const handleWindowWheel = (e: WheelEvent) => {
      if (!isHoveringForm) return;

      const target = e.target as HTMLElement;
      const isFormElement = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';
      
      if (isFormElement) {
        const canElementScroll = target.scrollHeight > target.clientHeight;
        
        if (!canElementScroll) {
          // Form element can't scroll - scroll parent instead
          const scrollAmount = e.deltaY;
          const currentScroll = mainContent.scrollTop;
          const maxScroll = mainContent.scrollHeight - mainContent.clientHeight;
          
          // Check if we can scroll in that direction
          const canScrollDown = scrollAmount > 0 && currentScroll < maxScroll;
          const canScrollUp = scrollAmount < 0 && currentScroll > 0;
          
          if (canScrollDown || canScrollUp) {
            // Scroll the parent and prevent form element from handling it
            mainContent.scrollTop += scrollAmount;
            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();
            return false;
          }
        }
      }
    };

    // Attach window-level handler in capture phase with high priority
    window.addEventListener('wheel', handleWindowWheel, { 
      passive: false, 
      capture: true 
    });

    return () => {
      formContainer.removeEventListener('mouseenter', handleMouseEnter);
      formContainer.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('wheel', handleWindowWheel, { capture: true });
    };
  }, []);

  // Remove itemization: consolidate to one "All Items" series per data_type (assets, income, etc.)
  const handleRemoveItemization = async () => {
    if (!chartId || seriesConfigurations.length === 0) return;
    setRemovingItemization(true);
    setMessage('');
    try {
      const byType = new Map();
      for (const series of seriesConfigurations) {
        const key = series.data_type || '';
        if (!key) continue;
        if (!byType.has(key)) {
          byType.set(key, {
            data_type: series.data_type,
            field: series.field || 'value',
            aggregation: series.aggregation || 'sum',
            label: 'All Items',
            color: series.color || getRandomColor(),
            category: '',
            selected_item_id: null,
            selected_account_ids: [],
            itemize: false,
          });
        }
      }

      let updatedSeries = Array.from(byType.values());
      if (updatedSeries.length === 0 && seriesConfigurations.length > 0) {
        const fallback = seriesConfigurations[0];
        updatedSeries = [{
          data_type: fallback.data_type,
          field: fallback.field || 'value',
          aggregation: fallback.aggregation || 'sum',
          label: 'All Items',
          color: fallback.color || getRandomColor(),
          category: '',
          selected_item_id: null,
          selected_account_ids: [],
          itemize: false,
        }];
      }

      setSeriesConfigurations(updatedSeries);
      const chartData = {
        name,
        chart_type: chartType,
        display_type: displayType,
        data_sources: dataSourcesOptions.join(','),
        series_configurations: JSON.stringify(updatedSeries),
        x_axis_label: xAxisLabel,
        y_axis_label: yAxisLabel,
      };
      await CustomChartService.update(String(chartId), chartData);
      await CustomChartService.recalculate(String(chartId));
      setMessage('Itemization removed. All series now show aggregated data.');
      setTimeout(() => setMessage(''), 5000);
    } catch (error: any) {
      setMessage(`Failed to remove itemization: ${error.response?.data?.detail || error.message}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setRemovingItemization(false);
    }
  };

  // Check if chart has itemized series (for showing Remove Itemization button)
  const hasItemizedSeries = seriesConfigurations.some((s: any) => {
    const hasItemId = (s.selected_item_id || s.item_id) && (s.selected_item_id !== null && s.selected_item_id !== "" && s.selected_item_id !== 0);
    const labelMatchesDefault = s.label === s.category || 
                               s.label === (s.data_type ? s.data_type.charAt(0).toUpperCase() + s.data_type.slice(1) : null) ||
                               s.label === 'All Categories' ||
                               s.label === 'All Items';
    return hasItemId || (!labelMatchesDefault && s.label && s.data_type);
  });

  return (
    <div className="custom-chart-form-container" ref={formRef}>
      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="chart-name">Name:</label>
          <input
            id="chart-name"
            name="chart-name"
            autoComplete="off"
            type="text"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="chart-type">Chart Type:</label>
          <select
            id="chart-type"
            name="chart-type"
            autoComplete="off"
            value={chartType}
            onChange={(e: any) => setChartType(e.target.value)}
            required
          >
            {chartTypes.map((type: any) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="display-type">Display Type:</label>
          <select
            id="display-type"
            name="display-type"
            autoComplete="off"
            value={displayType}
            onChange={(e: any) => setDisplayType(e.target.value)}
            required
          >
            <option value="chart">Chart only</option>
            <option value="table">Table only</option>
            <option value="both">Chart and Table</option>
          </select>
        </div>


        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <h4 style={{ margin: 0 }}>Series Configuration</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {chartId && hasItemizedSeries && (
              <button 
                type="button" 
                className="btn-primary-modern" 
                onClick={handleRemoveItemization}
                disabled={removingItemization}
                title="Remove itemization from all series. Each series will show aggregated totals (e.g. all assets, all income) instead of individual items."
              >
                {removingItemization ? 'Removing...' : 'Remove Itemization'}
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary-modern">
              {loading ? "Saving..." : (chartId ? "Update" : "Create Chart")}
            </button>
            <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary-modern">Cancel</button>
          </div>
        </div>
        <button type="button" className="btn-primary-modern" onClick={handleAddSeries}>Add Series</button>
        <div className="series-list">
          {seriesConfigurations.map((series: any, index: any) => {
            const currentSeriesDataType = series.data_type;
            const options = getDataSourceItemOptions(
              currentSeriesDataType, 
              assets, 
              liabilities, 
              incomeItems, 
              expenseItems, 
              series.category,
              series.selected_account_ids || []
            );

            return (
              <div key={index} className="series-item">
                <div className="form-group">
                  <label>Series Type:</label>
                  <select
                    value={series.data_type || ''}
                    onChange={(e: any) => handleSeriesChange(index, 'data_type', e.target.value)}
                  >
                    {dataTypeOptions.map((type: any) => (
                      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <>
                {/* Account multi-selector, only for assets */}
                {currentSeriesDataType === 'assets' && accounts && accounts.length > 0 && (
                  <div className="form-group">
                    <FormControlLabel
                      control={
                        <Switch
                          sx={projectionSwitchSx}
                          checked={!!series.include_selected_assets}
                          onChange={(e: any) => handleSeriesChange(index, 'include_selected_assets', e.target.checked)}
                        />
                      }
                      label="Include selected"
                    />
                    {series.include_selected_assets && (
                      <>
                        <div className="custom-chart-account-list">
                          {accounts.map((account: AccountItem) => {
                            const checked = (series.selected_account_ids || []).includes(account.id);
                            return (
                              <label key={account.id} className="custom-chart-account-option">
                                <input
                                  name="include-selected-assets"
                                  autoComplete="off"
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSelectedAccount(index, account.id)}
                                />
                                <span>{account.brokerage} - {account.account_name}</span>
                              </label>
                            );
                          })}
                        </div>
                        <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                          Choose accounts to include. Disable "Include Selected" to include all accounts.
                        </small>
                      </>
                    )}
                  </div>
                )}

                {/* Category dropdown, conditional based on data type */}
                {(currentSeriesDataType === 'assets' || currentSeriesDataType === 'liabilities' || currentSeriesDataType === 'income' || currentSeriesDataType === 'expenses') && (
                  <div className="form-group">
                    <label>Category:</label>
                    <select
                      value={series.category}
                      onChange={(e: any) => handleSeriesChange(index, 'category', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {(currentSeriesDataType === 'assets' && assetCategories ||
                       currentSeriesDataType === 'liabilities' && liabilityCategories ||
                       currentSeriesDataType === 'income' && incomeCategories ||
                       currentSeriesDataType === 'expenses' && expenseCategories ||
                       []).slice().sort().map((category: string) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(currentSeriesDataType === 'assets' || currentSeriesDataType === 'liabilities' || currentSeriesDataType === 'income' || currentSeriesDataType === 'expenses') && (() => {
                  const itemOptions = getDataSourceItemOptions(
                    currentSeriesDataType,
                    assets,
                    liabilities,
                    incomeItems,
                    expenseItems,
                    series.category,
                    series.selected_account_ids || []
                  );
                  const shouldExpand = series.selected_item_id === '';
                  const selectSize = shouldExpand ? Math.min(15, itemOptions.length + 1) : undefined;
                  
                  return (
                    <div className="form-group">
                      <label>{currentSeriesDataType.charAt(0).toUpperCase() + currentSeriesDataType.slice(1)}:</label>
                      <select
                        value={series.selected_item_id || ''}
                        onChange={(e: any) => {
                          handleSeriesChange(index, 'selected_item_id', e.target.value);
                          if (e.target.value && e.target.value !== '') {
                            handleSeriesChange(index, 'itemize', false);
                          }
                        }}
                        disabled={!!series.itemize}
                        style={{ 
                          position: 'relative',
                          zIndex: shouldExpand ? 10 : 1
                        }}
                        size={selectSize}
                      >
                        <option value="">All Items</option>
                        {itemOptions.map((item: DataItem) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      {series.itemize && (
                        <small style={{display: 'block', color: '#666', marginTop: '4px'}}>
                          Item selection is disabled when itemize is enabled
                        </small>
                      )}
                    </div>
                  );
                })()}

                    {/* TODO: Dynamically render fields based on selected data_type */}
                    <div className="form-group">
                      <label>Field:</label>
                      <input
                        type="text"
                        name="field"
                        autoComplete="off"
                        value={series.field}
                        onChange={(e: any) => handleSeriesChange(index, 'field', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Aggregation:</label>
                      <select
                        name="aggregation"
                        autoComplete="off"
                        value={series.aggregation}
                        onChange={(e: any) => handleSeriesChange(index, 'aggregation', e.target.value)}
                      >
                        {aggregationOptions.map((agg: any) => <option key={agg} value={agg}>{agg}</option>)}
                      </select>
                    </div>
                  </>

                <div className="form-group">
                  <label>Label:</label>
                  <input
                    type="text"
                    name="label"
                    autoComplete="off"
                    value={series.label}
                    onChange={(e: any) => handleSeriesChange(index, 'label', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Color:</label>
                  <input
                    type="color"
                    name="color"
                    autoComplete="off"
                    value={series.color}
                    onChange={(e: any) => handleSeriesChange(index, 'color', e.target.value)}
                  />
                </div>

                {/* Itemize option - show if no specific item is selected */}
                {!series.selected_item_id && (
                  <div className="form-group">
                    <FormControlLabel
                      control={
                        <Switch
                          sx={projectionSwitchSx}
                          checked={series.itemize || false}
                          onChange={(e: any) => {
                            handleSeriesChange(index, 'itemize', e.target.checked);
                          }}
                        />
                      }
                      label="Itemize (show individual items)"
                      sx={{ m: 0 }}
                    />
                    <small style={{display: 'block', color: '#666', marginTop: '4px'}}>
                      When enabled, each {(currentSeriesDataType === 'assets' ? 'asset' : 
                                            currentSeriesDataType === 'liabilities' ? 'liability' : 
                                            currentSeriesDataType === 'income' ? 'income' : 'expense')} item will be displayed as a separate series/slice
                    </small>
                  </div>
                )}

                <button type="button" onClick={() => handleRemoveSeries(index)}>Remove</button>
              </div>
            );
          })}
        </div>

        <div className="form-group">
          <label htmlFor="x-axis-label">X-Axis Label:</label>
          <input
            id="x-axis-label"
            type="text"
            name="x-axis-label"
            autoComplete="off"
            value={xAxisLabel}
            onChange={(e: any) => setXAxisLabel(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="y-axis-label">Y-Axis Label:</label>
          <input
            id="y-axis-label"
            type="text"
            name="y-axis-label"
            autoComplete="off"
            value={yAxisLabel}
            onChange={(e: any) => setYAxisLabel(e.target.value)}
          />
        </div>
      </form>
    </div>
  );
}
