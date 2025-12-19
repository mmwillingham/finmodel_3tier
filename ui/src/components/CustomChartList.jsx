import React, { useState, useEffect } from 'react';
import CustomChartService from '../services/customChart.service';
import './CustomChartList.css'; // We will create this CSS file

export default function CustomChartList({ onEditChart, onCreateNewChart, onViewChart }) {
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const response = await CustomChartService.getAll();
      setCharts(response.data);
    } catch (error) {
      console.error("Error fetching custom charts:", error);
      setMessage("Failed to load custom charts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, []);

  const handleDelete = async (chartId) => {
    if (window.confirm("Are you sure you want to delete this chart?")) {
      try {
        await CustomChartService.delete(chartId);
        setMessage("Chart deleted successfully!");
        fetchCharts(); // Refresh the list
      } catch (error) {
        console.error("Error deleting custom chart:", error);
        setMessage("Failed to delete chart.");
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading custom charts...</div>;
  }

  return (
    <div className="custom-chart-list-container">
      <h3>Your Custom Charts and Tables</h3>
      {message && <div className="message">{message}</div>}
      <button className="create-chart-btn" onClick={onCreateNewChart}>Create New Charts and Tables</button>

      {charts.length === 0 ? (
        <p>You haven't created any custom charts yet.</p>
      ) : (
        <div className="chart-cards-container">
          {charts.map((chart) => (
            <div key={chart.id} className="chart-card" onClick={() => onViewChart(chart.id)}>
              <div className="chart-card-header">
                <h4>{chart.name}</h4>
                <div className="chart-card-actions">
                  <button onClick={(e) => { e.stopPropagation(); onViewChart(chart.id); }} className="icon-btn" title="View"><span role="img" aria-label="view">🔍</span></button>
                  <button onClick={(e) => { e.stopPropagation(); onEditChart(chart.id); }} className="icon-btn" title="Edit"><span role="img" aria-label="edit">✏️</span></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(chart.id); }} className="icon-btn" title="Delete"><span role="img" aria-label="delete">🗑️</span></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}