import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import CustomChartService from '../services/customChart.service';
import ConfirmDialog from './ConfirmDialog';
import './CustomChartList.css'; // We will create this CSS file

export default function CustomChartList({ onEditChart, onCreateNewChart, onViewChart }) {
  const { viewingUserId } = useAuth();
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [recalculatingChartId, setRecalculatingChartId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null, title: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const response = await CustomChartService.getAll(viewingUserId);
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
  }, [viewingUserId]);

  const handleRecalculate = async (chartId) => {
    setRecalculatingChartId(chartId);
    setMessage('');
    try {
      await CustomChartService.recalculate(chartId);
      setMessage("Chart recalculated successfully!");
      fetchCharts(); // Refresh the list to show updated data
      // Dispatch event to notify CustomChartView to refresh
      window.dispatchEvent(new CustomEvent('chartRecalculated', { detail: { chartId } }));
    } catch (error) {
      console.error("Error recalculating chart:", error);
      setMessage("Failed to recalculate chart.");
    } finally {
      setRecalculatingChartId(null);
    }
  };

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
      title: 'Recalculate All',
      message: 'This will recalculate all charts with current data. Continue?',
      onConfirm: async () => {
        setRecalculating(true);
        setMessage('');
        try {
          const response = await CustomChartService.recalculateAll();
          const data = response.data;
          setMessage(`Successfully recalculated ${data.recalculated_count} of ${data.total_charts} charts.${data.errors.length > 0 ? ` ${data.errors.length} error(s) occurred.` : ''}`);
          fetchCharts(); // Refresh the list to show updated data
          // Dispatch event to notify CustomChartView to refresh all charts
          window.dispatchEvent(new CustomEvent('chartRecalculated', { detail: { chartId: 'all' } }));
        } catch (error) {
          console.error("Error recalculating charts:", error);
          setMessage("Failed to recalculate charts. Please try again.");
        } finally {
          setRecalculating(false);
        }
      }
    });
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedCharts = [...charts].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    // Handle dates
    if (sortConfig.key === 'updated_at' || sortConfig.key === 'created_at') {
      aVal = aVal ? new Date(aVal) : new Date(0);
      bVal = bVal ? new Date(bVal) : new Date(0);
    }

    // Handle strings
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aVal > bVal) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return <div className="loading">Loading custom charts...</div>;
  }

  return (
    <div className="custom-chart-list-container">
      <h3>Your Custom Charts and Tables</h3>
      {message && <div className="message">{message}</div>}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="create-chart-btn" onClick={onCreateNewChart}>Create</button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="create-chart-btn" 
            onClick={handleRecalculateAll}
            disabled={recalculating || charts.length === 0}
            style={{ backgroundColor: recalculating ? '#ccc' : '#28a745', opacity: charts.length === 0 ? 0.5 : 1 }}
          >
            {recalculating ? 'Recalculating...' : 'Recalculate All'}
          </button>
          <span style={{ fontSize: '0.9em', color: '#666', maxWidth: '400px', lineHeight: '1.4' }}>
            Recalculate after adding, editing, or deleting assets, liabilities, income, or expenses to update chart and table data with the latest projections.
          </span>
        </div>
      </div>

      {charts.length === 0 ? (
        <p>You haven't created any custom charts yet.</p>
      ) : (
        <table className="custom-charts-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Name {getSortIcon('name')}
              </th>
              <th onClick={() => handleSort('chart_type')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Type {getSortIcon('chart_type')}
              </th>
              <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Created {getSortIcon('created_at')}
              </th>
              <th onClick={() => handleSort('updated_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Last Updated {getSortIcon('updated_at')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCharts.map((chart) => (
              <tr key={chart.id}>
                <td>{chart.name}</td>
                <td>{chart.chart_type}</td>
                <td>{formatDate(chart.created_at)}</td>
                <td>{formatDate(chart.updated_at)}</td>
                <td className="actions-cell">
                  <button onClick={() => onViewChart(chart.id)} className="btn-icon" title="View">
                    📊
                  </button>
                  <button onClick={() => onEditChart(chart.id)} className="btn-icon" title="Edit">
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleRecalculate(chart.id)} 
                    className="btn-icon" 
                    title="Recalculate"
                    disabled={recalculatingChartId === chart.id}
                    style={{ opacity: recalculatingChartId === chart.id ? 0.5 : 1 }}
                  >
                    {recalculatingChartId === chart.id ? '⏳' : '🔄'}
                  </button>
                  <button onClick={() => handleDelete(chart.id)} className="btn-icon" title="Delete">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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