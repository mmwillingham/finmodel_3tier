import React, { useState, useEffect } from 'react';
import CustomChartService from '../services/customChart.service';
import './CustomChartForm.css'; // We will create this CSS file

const chartTypes = ["line", "bar", "pie"];
const dataSourcesOptions = ["assets", "liabilities", "income", "expenses"];
const aggregationOptions = ["sum", "average", "count"];

// Helper to generate a random color
const getRandomColor = () => {
  const randomHex = Math.floor(Math.random() * 16777215).toString(16);
  return "#" + ("000000" + randomHex).slice(-6);
};

const getCategoryOptions = (dataType, assetCategories, liabilityCategories, incomeCategories, expenseCategories) => {
  switch (dataType) {
    case 'assets': return assetCategories;
    case 'liabilities': return liabilityCategories;
    case 'income': return incomeCategories;
    case 'expenses': return expenseCategories;
    default: return [];
  }
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
          setSeriesConfigurations(JSON.parse(chart.series_configurations).map(series => ({ ...series, category: series.category || '' })));
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
    const defaultDataType = selectedDataSources.length > 0 ? selectedDataSources[0] : dataSourcesOptions[0];
    setSeriesConfigurations(prev => [...prev, {
      data_type: defaultDataType,
      field: "value", // Default field, will need to be dynamic later
      aggregation: "sum",
      label: "", // Initialize with empty string, user will fill this

      color: getRandomColor(),
      category: "", // New category field
    }]);
  };

  const handleSeriesChange = (index, field, value) => {
    const newSeries = [...seriesConfigurations];
    newSeries[index][field] = value;
    // Reset category if data_type changes
    if (field === 'data_type') {
      newSeries[index].category = '';
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
      data_sources: selectedDataSources.join(','),
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

  return (
    <div className="custom-chart-form-container">
      <h3>{chartId ? "Edit Custom Chart" : "Create New Custom Chart"}</h3>
      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="chart-name">Chart Name:</label>
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
            <option value="chart">Chart Only</option>
            <option value="table">Table Only</option>
            <option value="both">Both Chart and Table</option>
          </select>
        </div>

        <div className="form-group">
          <label>Data Sources:</label>
          <div className="checkbox-group">
            {dataSourcesOptions.map(source => (
              <label key={source}>
                <input
                  type="checkbox"
                  value={source}
                  checked={selectedDataSources.includes(source)}
                  onChange={handleDataSourceChange}
                />
                {source.charAt(0).toUpperCase() + source.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <h4>Series Configuration</h4>
        <button type="button" onClick={handleAddSeries}>Add Series</button>
        <div className="series-list">
          {seriesConfigurations.map((series, index) => {
            const currentSeriesDataType = series.data_type;
            const options = getCategoryOptions(currentSeriesDataType, assetCategories, liabilityCategories, incomeCategories, expenseCategories);

            return (
              <div key={index} className="series-item">
                <div className="form-group">
                  <label>Data Type:</label>
                  <select
                    value={series.data_type}
                    onChange={(e) => handleSeriesChange(index, 'data_type', e.target.value)}
                  >
                    {selectedDataSources.map(source => (
                      <option key={source} value={source}>{source.charAt(0).toUpperCase() + source.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Category dropdown, conditional based on data type */}
                {(currentSeriesDataType === 'assets' || currentSeriesDataType === 'liabilities' || currentSeriesDataType === 'income' || currentSeriesDataType === 'expenses') && (
                  <div className="form-group">
                    <label>Category:</label>
                    <select
                      value={series.category}
                      onChange={(e) => handleSeriesChange(index, 'category', e.target.value)}
                    >
                      {options.length > 0 ? (
                        <>
                          <option value="">All Categories</option>
                          {options.map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </>
                      ) : (
                        <option value="" disabled>No categories available</option>
                      )}
                    </select>
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

        <div className="modal-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : (chartId ? "Update Chart" : "Create Chart")}
          </button>
          <button type="button" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
