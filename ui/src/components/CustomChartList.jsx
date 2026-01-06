import React, { useState, useEffect } from 'react';
import CustomChartService from '../services/customChart.service';
import ConfirmDialog from './ConfirmDialog';
import './CustomChartList.css'; // We will create this CSS file

export default function CustomChartList({ onEditChart, onCreateNewChart, onViewChart }) {
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });

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
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Chart',
      message: 'Are you sure you want to delete this chart?',
      onConfirm: async () => {
        try {
          await CustomChartService.delete(chartId);
          setMessage("Chart deleted successfully!");
          fetchCharts(); // Refresh the list
        } catch (error) {
          console.error("Error deleting custom chart:", error);
          setMessage("Failed to delete chart.");
        }
      }
    });
  };

  const handleRecalculateAll = async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Recalculate All Charts',
      message: 'This will recalculate all charts with current data. Continue?',
      onConfirm: async () => {
        setRecalculating(true);
        setMessage('');
        try {
          const response = await CustomChartService.recalculateAll();
          const data = response.data;
          setMessage(`Successfully recalculated ${data.recalculated_count} of ${data.total_charts} charts.${data.errors.length > 0 ? ` ${data.errors.length} error(s) occurred.` : ''}`);
          fetchCharts(); // Refresh the list to show updated data
        } catch (error) {
          console.error("Error recalculating charts:", error);
          setMessage("Failed to recalculate charts. Please try again.");
        } finally {
          setRecalculating(false);
        }
      }
    });
  };

  if (loading) {
    return <div className="loading">Loading custom charts...</div>;
  }

  return (
    <div className="custom-chart-list-container">
      <h3>Your Custom Charts and Tables</h3>
      {message && <div className="message">{message}</div>}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className="create-chart-btn" onClick={onCreateNewChart}>Create New Charts and Tables</button>
        <button 
          className="create-chart-btn" 
          onClick={handleRecalculateAll}
          disabled={recalculating || charts.length === 0}
          style={{ backgroundColor: recalculating ? '#ccc' : '#28a745', opacity: charts.length === 0 ? 0.5 : 1 }}
        >
          {recalculating ? 'Recalculating...' : 'Recalculate All Charts'}
        </button>
      </div>

      {charts.length === 0 ? (
        <p>You haven't created any custom charts yet.</p>
      ) : (
        <div className="chart-cards-container">
          {charts.sort((a, b) => a.name.localeCompare(b.name)).map((chart) => (
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: null, title: '' })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}