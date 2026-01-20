import React, { useState, useEffect, useRef } from 'react';
import CustomChartService from '../services/customChart.service';
import AccountService from '../services/account.service';
import MultiSelectCheckbox from './MultiSelectCheckbox'; // Import the multi-select checkbox component
import './CustomChartForm.css'; // We will create this CSS file

const chartTypes = ["line", "bar", "pie"];
const dataSourcesOptions = ["assets", "liabilities", "income", "expenses"];
const dataTypeOptions = ["assets", "liabilities", "income", "expenses"];
const aggregationOptions = ["sum", "average", "count"];

// Helper to generate a random color
const getRandomColor = () => {
  const randomHex = Math.floor(Math.random() * 16777215).toString(16);
  return "#" + ("000000" + randomHex).slice(-6);
};

const getDataSourceItemOptions = (dataType, assets, liabilities, incomeItems, expenseItems, selectedCategory, selectedAccountIds = []) => {
  let items = [];
  switch (dataType) {
    case 'assets': items = assets; break;
    case 'liabilities': items = liabilities; break;
    case 'income': items = incomeItems; break;
    case 'expenses': items = expenseItems; break;
    default: return [];
  }

  // Filter by category if a specific category is selected
  if (selectedCategory) {
    items = items.filter(item => item.category === selectedCategory);
  }

  // Filter by account if accounts are selected (only for assets which have account_id)
  // When accounts are selected, show ONLY assets that belong to those accounts
  // When NO accounts are selected, show ALL assets (no filtering)
  if (dataType === 'assets' && selectedAccountIds && selectedAccountIds.length > 0) {
    items = items.filter(item => {
      // Include assets that belong to one of the selected accounts
      // This means if an asset has an account_id, it must match one of the selected accounts
      // Assets without account_id are excluded when accounts are selected (they would show when no accounts are selected)
      return item.account_id && selectedAccountIds.includes(item.account_id);
    });
  }
  // When selectedAccountIds is empty or not provided, show ALL assets (no filtering)

  // Map to a consistent format for options
  return items.map(item => ({
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
}) {
  const [name, setName] = useState("");
  const [chartType, setChartType] = useState(chartTypes[0]);
  const [displayType, setDisplayType] = useState("chart"); // New state for display type
  const [selectedDataSources, setSelectedDataSources] = useState(dataSourcesOptions); // Initialize with all options selected
  const [seriesConfigurations, setSeriesConfigurations] = useState([]);
  const [xAxisLabel, setXAxisLabel] = useState("Year");
  const [yAxisLabel, setYAxisLabel] = useState("Value");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshingItemization, setRefreshingItemization] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (chartId) {
      // Editing existing chart
      setLoading(true);
      CustomChartService.get(chartId)
        .then(response => {
          const chart = response.data;
          setName(chart.name);
          setChartType(chart.chart_type);
          setDisplayType(chart.display_type || "chart"); // Set display type from fetched config
          setSelectedDataSources(chart.data_sources ? chart.data_sources.split(',') : []);
          setSeriesConfigurations(JSON.parse(chart.series_configurations).map(series => ({ 
            ...series, 
            category: series.category || '', 
            selected_item_id: series.selected_item_id || null,
            selected_account_ids: series.selected_account_ids || [], // Load account filter if present
            itemize: series.itemize || false, // Load itemize flag if present
          })));
          setXAxisLabel(chart.x_axis_label || "");
          setYAxisLabel(chart.y_axis_label || "");
        })
        .catch(error => {
          console.error("Error loading chart for edit:", error);
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

  const handleDataSourceChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedDataSources(prev => [...prev, value]);
    } else {
      setSelectedDataSources(prev => prev.filter(source => source !== value));
    }
  };

  const handleAddSeries = () => {
    // Always use first data source option (assets) as default when adding a new series
    const defaultDataType = dataSourcesOptions[0];
    // Set default label to capitalized data type name
    const defaultLabel = defaultDataType ? defaultDataType.charAt(0).toUpperCase() + defaultDataType.slice(1) : "";
    setSeriesConfigurations(prev => [...prev, {
      data_type: defaultDataType,
      field: "value", // Default field, will need to be dynamic later
      aggregation: "sum",
      label: defaultLabel, // Initialize with capitalized data type name
      color: getRandomColor(),
      category: "", // New category field
      selected_item_id: null, // Initialize selected_item_id
      selected_account_ids: [], // Initialize account filter
      itemize: false, // Initialize itemize flag
    }]);
  };

  const handleSeriesChange = (index, field, value) => {
    const newSeries = [...seriesConfigurations];
    newSeries[index][field] = value;
    // Reset category, selected_item_id, and selected_account_ids if data_type changes
    if (field === 'data_type') {
      newSeries[index].category = '';
      newSeries[index].selected_item_id = null;
      newSeries[index].selected_account_ids = [];
      // Set default label to data type name (capitalized) when only data type is selected
      const dataTypeLabel = value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
      newSeries[index].label = dataTypeLabel;
    }
    
    // Handle account multi-select changes
    if (field === 'selected_account_ids') {
      newSeries[index].selected_account_ids = value || [];
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
        const selectedItem = options.find(item => {
          const itemId = String(item.id);
          const valueId = String(value);
          return itemId === valueId;
        });
        if (selectedItem) {
          newSeries[index].label = selectedItem.name;
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

  const handleRemoveSeries = (index) => {
    setSeriesConfigurations(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
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
        await CustomChartService.update(chartId, chartData);
        setMessage("Chart updated successfully!");
      } else {
        await CustomChartService.create(chartData);
        setMessage("Chart created successfully!");
      }
      onChartSaved();
    } catch (error) {
      console.error("Error saving chart:", error.response?.data?.detail || error.message);
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

    const mainContent = formContainer.closest('.main-content');
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
    const handleWindowWheel = (e) => {
      if (!isHoveringForm) return;

      const target = e.target;
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

  // Handle Refresh Itemization - similar to CustomChartView
  const handleRefreshItemization = async () => {
    if (!chartId || seriesConfigurations.length === 0) return;
    
    setRefreshingItemization(true);
    setMessage('');
    
    try {
      let needsUpdate = false;
      let matchedCount = 0;
      let unmatchedCount = 0;
      
      const updatedSeries = seriesConfigurations.map(series => {
        const selectedItemId = series.selected_item_id || series.item_id;
        const isItemized = selectedItemId && selectedItemId !== "" && selectedItemId !== null && selectedItemId !== 0;
        
        // Check if label looks like a stale item name
        const labelMatchesDefault = series.label === series.category || 
                                   series.label === (series.data_type ? series.data_type.charAt(0).toUpperCase() + series.data_type.slice(1) : null) ||
                                   series.label === 'All Categories' ||
                                   series.label === 'All Items' ||
                                   !series.label;
        const hasStaleLabel = !labelMatchesDefault && series.label && series.data_type;
        
        // If series is NOT itemized and doesn't have a stale label, pass through unchanged
        // This preserves non-itemized series (which show all items) and prevents them from being modified
        if (!isItemized && !hasStaleLabel) {
          return series; // Pass through for duplicate checking
        }
        
        // Only process itemized series or series with stale labels
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
          return series;
        }
        
        // Try to find item by ID first (only for itemized series)
        let foundItem = null;
        if (isItemized) {
          const itemIdNum = typeof selectedItemId === 'string' ? parseInt(selectedItemId, 10) : selectedItemId;
          foundItem = items.find(item => item.id === itemIdNum || item.id === selectedItemId);
        }
        
        // If not found by ID, try to find by label/name (only for itemized series or stale labels)
        if (!foundItem && (isItemized || hasStaleLabel) && series.label) {
          foundItem = items.find(item => {
            const itemName = item.description || item.name;
            return itemName === series.label;
          });
        }
        
        // If item was found, update the ID and label (keep it itemized)
        if (foundItem) {
          matchedCount++;
          needsUpdate = true;
          const currentItemName = foundItem.description || foundItem.name;
          return {
            ...series,
            selected_item_id: foundItem.id,
            item_id: foundItem.id,
            label: currentItemName,
            itemize: true, // Ensure itemize flag is set
          };
        }
        
        // Item not found - only un-itemize if it was previously itemized
        // If it was never itemized (hasStaleLabel but not isItemized), don't change it
        if (!isItemized && hasStaleLabel) {
          // Stale label but not itemized - just update the label to a default
          let newLabel;
          if (series.category) {
            newLabel = series.category;
          } else if (series.data_type) {
            newLabel = series.data_type.charAt(0).toUpperCase() + series.data_type.slice(1);
          } else {
            newLabel = 'All Items';
          }
          return {
            ...series,
            label: newLabel,
          };
        }
        
        // Item was itemized but not found - remove itemization (show all items in category)
        unmatchedCount++;
        needsUpdate = true;
        
        let newLabel;
        if (series.category) {
          newLabel = series.category;
        } else if (series.data_type) {
          newLabel = series.data_type.charAt(0).toUpperCase() + series.data_type.slice(1);
        } else {
          newLabel = 'All Items';
        }
        
        return {
          ...series,
          selected_item_id: null,
          item_id: null,
          itemize: false, // Ensure itemize flag is cleared
          label: newLabel,
        };
      });
      
      // Consolidate duplicate series
      const seriesMap = new Map();
      const consolidatedSeries = [];
      
      updatedSeries.forEach(series => {
        const selectedItemId = series.selected_item_id || series.item_id;
        const isStillItemized = selectedItemId && selectedItemId !== "" && selectedItemId !== null && selectedItemId !== 0;
        
        let key;
        if (isStillItemized) {
          key = `${series.data_type}_${series.category || 'all'}_${selectedItemId}`;
        } else {
          key = `${series.data_type}_${series.category || 'all'}_unitemized`;
        }
        
        if (!seriesMap.has(key)) {
          seriesMap.set(key, series);
          consolidatedSeries.push(series);
        } else {
          needsUpdate = true;
        }
      });
      
      const finalSeries = consolidatedSeries.length < updatedSeries.length ? consolidatedSeries : updatedSeries;
      
      if (needsUpdate || consolidatedSeries.length < updatedSeries.length) {
        setSeriesConfigurations(finalSeries);
        
        // Build success message
        const duplicatesRemoved = consolidatedSeries.length < updatedSeries.length;
        const duplicateCount = updatedSeries.length - consolidatedSeries.length;
        let messageText = 'Itemization refreshed. ';
        if (matchedCount > 0 && unmatchedCount === 0 && !duplicatesRemoved) {
          messageText += `All ${matchedCount} itemized series re-matched to current items.`;
        } else if (matchedCount > 0 && unmatchedCount > 0) {
          messageText += `${matchedCount} series re-matched. ${unmatchedCount} series un-itemized (items not found).`;
          if (duplicatesRemoved) {
            messageText += ` ${duplicateCount} duplicate series removed.`;
          }
        } else if (unmatchedCount > 0) {
          messageText += `${unmatchedCount} series un-itemized (items not found).`;
          if (duplicatesRemoved) {
            messageText += ` ${duplicateCount} duplicate series removed.`;
          }
          messageText += ' You can re-itemize individual series if needed.';
        } else if (duplicatesRemoved) {
          messageText += `${duplicateCount} duplicate series removed.`;
        } else {
          messageText += 'Chart updated.';
        }
        
        setMessage(messageText);
        setTimeout(() => setMessage(''), 5000);
      } else {
        setMessage('Itemization is up to date. All linked items are valid.');
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error("Error refreshing itemization:", error);
      setMessage(`Failed to refresh itemization: ${error.response?.data?.detail || error.message}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setRefreshingItemization(false);
    }
  };

  // Check if chart has itemized series (for showing Refresh Itemization button)
  const hasItemizedSeries = seriesConfigurations.some(s => {
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
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="chart-type">Chart Type:</label>
          <select
            id="chart-type"
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            required
          >
            {chartTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="display-type">Display Type:</label>
          <select
            id="display-type"
            value={displayType}
            onChange={(e) => setDisplayType(e.target.value)}
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
                onClick={handleRefreshItemization}
                disabled={refreshingItemization}
                title="Refresh itemization - removes all itemization and re-matches series to current items by name. Items not found will be un-itemized."
              >
                {refreshingItemization ? 'Refreshing...' : 'Refresh Itemization'}
              </button>
            )}
            <button type="submit" disabled={loading} className="btn-primary-modern">
              {loading ? "Saving..." : (chartId ? "Update" : "Create Chart")}
            </button>
            <button type="button" onClick={onCancel} disabled={loading} className="btn-primary-modern" style={{ backgroundColor: '#6c757d' }}>Cancel</button>
          </div>
        </div>
        <button type="button" className="btn-primary-modern" onClick={handleAddSeries}>Add Series</button>
        <div className="series-list">
          {seriesConfigurations.map((series, index) => {
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
                    onChange={(e) => handleSeriesChange(index, 'data_type', e.target.value)}
                  >
                    {dataTypeOptions.map(type => (
                      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <>
                {/* Account multi-selector, only for assets */}
                {currentSeriesDataType === 'assets' && accounts && accounts.length > 0 && (
                  <div className="form-group">
                    <label>Account(s):</label>
                    <MultiSelectCheckbox
                      options={accounts.map(account => ({
                        id: account.id,
                        brokerage: account.brokerage,
                        account_name: account.account_name,
                      }))}
                      selectedValues={series.selected_account_ids || []}
                      onChange={(selectedValues) => {
                        handleSeriesChange(index, 'selected_account_ids', selectedValues);
                      }}
                      placeholder="Select accounts..."
                      maxHeight={200}
                      showCategory={false}
                    />
                  </div>
                )}

                {/* Category dropdown, conditional based on data type */}
                {(currentSeriesDataType === 'assets' || currentSeriesDataType === 'liabilities' || currentSeriesDataType === 'income' || currentSeriesDataType === 'expenses') && (
                  <div className="form-group">
                    <label>Category:</label>
                    <select
                      value={series.category}
                      onChange={(e) => handleSeriesChange(index, 'category', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {(currentSeriesDataType === 'assets' && assetCategories ||
                       currentSeriesDataType === 'liabilities' && liabilityCategories ||
                       currentSeriesDataType === 'income' && incomeCategories ||
                       currentSeriesDataType === 'expenses' && expenseCategories ||
                       []).slice().sort().map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(currentSeriesDataType === 'assets' || currentSeriesDataType === 'liabilities' || currentSeriesDataType === 'income' || currentSeriesDataType === 'expenses') && (
                  <div className="form-group">
                    <label>{currentSeriesDataType.charAt(0).toUpperCase() + currentSeriesDataType.slice(1)}:</label>
                    <select
                      value={series.selected_item_id || ''}
                      onChange={(e) => {
                        handleSeriesChange(index, 'selected_item_id', e.target.value);
                        // Clear itemize if a specific item is selected
                        if (e.target.value && e.target.value !== '') {
                          handleSeriesChange(index, 'itemize', false);
                        }
                      }}
                      disabled={!!series.itemize}
                      style={{ 
                        position: 'relative',
                        zIndex: series.selected_item_id === '' ? 10 : 1
                      }}
                      {...(series.selected_item_id === '' && {
                        size: Math.min(15, getDataSourceItemOptions(
                          currentSeriesDataType,
                          assets,
                          liabilities,
                          incomeItems,
                          expenseItems,
                          series.category,
                          series.selected_account_ids || []
                        ).length + 1)
                      })}
                    >
                      <option value="">All Items</option>
                      {getDataSourceItemOptions(
                        currentSeriesDataType,
                        assets,
                        liabilities,
                        incomeItems,
                        expenseItems,
                        series.category,
                        series.selected_account_ids || []
                      ).map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    {series.itemize && (
                      <small style={{display: 'block', color: '#666', marginTop: '4px'}}>
                        Item selection is disabled when itemize is enabled
                      </small>
                    )}
                  </div>
                )}

                    {/* TODO: Dynamically render fields based on selected data_type */}
                    <div className="form-group">
                      <label>Field:</label>
                      <input
                        type="text"
                        value={series.field}
                        onChange={(e) => handleSeriesChange(index, 'field', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Aggregation:</label>
                      <select
                        value={series.aggregation}
                        onChange={(e) => handleSeriesChange(index, 'aggregation', e.target.value)}
                      >
                        {aggregationOptions.map(agg => <option key={agg} value={agg}>{agg}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Label:</label>
                  <input
                    type="text"
                    value={series.label}
                    onChange={(e) => handleSeriesChange(index, 'label', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Color:</label>
                  <input
                    type="color"
                    value={series.color}
                    onChange={(e) => handleSeriesChange(index, 'color', e.target.value)}
                  />
                </div>

                {/* Itemize option - show if no specific item is selected */}
                {!series.selected_item_id && (
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={series.itemize || false}
                        onChange={(e) => {
                          handleSeriesChange(index, 'itemize', e.target.checked);
                          // When enabling itemize, clear account filters but preserve category
                          if (e.target.checked) {
                            handleSeriesChange(index, 'selected_account_ids', []);
                          }
                        }}
                      />
                      Itemize (show individual items)
                    </label>
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
            value={xAxisLabel}
            onChange={(e) => setXAxisLabel(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="y-axis-label">Y-Axis Label:</label>
          <input
            id="y-axis-label"
            type="text"
            value={yAxisLabel}
            onChange={(e) => setYAxisLabel(e.target.value)}
          />
        </div>
      </form>
    </div>
  );
}
