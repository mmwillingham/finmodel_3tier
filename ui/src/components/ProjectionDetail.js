import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import ProjectionService from '../services/projection.service';
import './ProjectionDetail.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);


const ProjectionDetail = ({ projectionId, onEdit, onDelete }) => {
  const id = projectionId;

  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [accountDetails, setAccountDetails] = useState([]);

  useEffect(() => {
    if (!id) {
      setError("No projection ID provided.");
      setLoading(false);
      return;
    }

    const fetchProjection = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const projData = await ProjectionService.getProjectionDetails(id); 
        setProjection(projData);

        if (projData?.data_json) {
          const parsed = JSON.parse(projData.data_json);
          setData(parsed);
          setAccountDetails(parsed);
        }
      } catch (err) {
        setError(err.message || "Failed to load projection.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjection();
  }, [id]);

  const getAccountNames = () => {
    if (!accountDetails || accountDetails.length === 0) return [];
    const keys = Object.keys(accountDetails[0]);
    return keys.filter(k => k !== 'Year' && k !== 'StartingValue' && k !== 'Total_Contribution' && k !== 'Total_Growth' && k !== 'Total_Value');
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v ?? 0);

  const getCurrentYear = () => new Date().getFullYear();

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!projection) return <p>No projection found.</p>;

  const accountNames = getAccountNames();
  const currentYear = getCurrentYear();

  // Prepare chart data
  const chartLabels = data.map((_, idx) => currentYear + idx);
  const chartDatasets = accountNames.map((name, idx) => ({
    label: name,
    data: accountDetails.map(year => year[name]),
    borderColor: `hsl(${idx * 60}, 70%, 50%)`,
    backgroundColor: `hsla(${idx * 60}, 70%, 50%, 0.1)`,
    tension: 0.4,
  }));

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `${projection.name} - Growth Over Time` },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) =>
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value),
        },
      },
    },
  };

  return (
    <div className="projection-detail">
      <div className="projection-header">
        <div>
          <h2>{projection.name}</h2>
          <p>Years: {projection.years}</p>
        </div>
        <div className="projection-actions">
          {onEdit && <button onClick={() => onEdit(projection)} className="edit-btn">Edit</button>}
          {onDelete && <button onClick={() => onDelete(projection.id)} className="delete-btn">Delete</button>}
        </div>
      </div>

      <h3>Growth Chart</h3>
      <div className="chart-container">
        <Line data={{ labels: chartLabels, datasets: chartDatasets }} options={chartOptions} />
      </div>

      <h3>Year-by-Year Breakdown</h3>
      <table className="projection-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Starting Value</th>
            <th>Contributions</th>
            <th>Growth</th>
            <th>Final Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((year, idx) => (
            <tr key={idx}>
              <td>{currentYear + idx}</td>
              <td>{formatCurrency(year.StartingValue)}</td>
              <td>{formatCurrency(year.Total_Contribution)}</td>
              <td>{formatCurrency(year.Total_Growth)}</td>
              <td>{formatCurrency(year.Total_Value)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Account Details</h3>
      <table className="projection-table">
        <thead>
          <tr>
            <th>Year</th>
            {accountNames.map(name => (
              <th key={name}>{name}</th>
            ))}
            <th>Final Value</th>
          </tr>
        </thead>
        <tbody>
          {accountDetails.map((year, idx) => (
            <tr key={idx}>
              <td>{currentYear + idx}</td>
              {accountNames.map(name => (
                <td key={name}>{formatCurrency(year[name])}</td>
              ))}
              <td>{formatCurrency(year.Total_Value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectionDetail;
