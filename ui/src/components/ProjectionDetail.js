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

const getAccountKeys = (data) => {
    if (!data || data.length === 0) return [];
    
    // Check all keys in the first data object
    const keys = Object.keys(data[0]);
    
    // Filter out the standard keys and return only the account value keys
    return keys.filter(key => key.endsWith('_Value'));
};

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!projection) return <p>No projection found.</p>;

  const accountNames = getAccountNames();

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
              <td>{year.Year}</td>
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
              <td>{year.Year}</td>
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
