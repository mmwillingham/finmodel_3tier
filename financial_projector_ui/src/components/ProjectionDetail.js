import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

const ProjectionDetail = ({ projectionId }) => {
    const id = projectionId;
    const navigate = useNavigate();

    const [projection, setProjection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
                const data = await ProjectionService.getProjectionDetails(id); 
                setProjection(data); 

            } catch (err) {
                console.error("Error fetching projection:", err);
                if (err.response && (err.response.status === 404 || err.response.status === 403)) {
                    setError("Error loading projection. It may not exist or you lack access.");
                } else {
                    setError("An unexpected error occurred while fetching data.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProjection();
    }, [id]);

    const { 
        name, 
        years, 
        final_value, 
        data_json,
        total_contributed = 0, 
        total_growth = 0
    } = projection || {}; 
    
    if (loading) {
        return <div className="loading-state">Loading projection data...</div>;
    }

    if (error) {
        return <div className="error-state">{error}</div>;
    }

    if (!projection) {
         return <div className="error-state">No projection data available.</div>;
    }

    // Prepare chart data: parse the JSON string
    const chartData = data_json ? JSON.parse(data_json) : [];

    const accountValueKeys = getAccountKeys(chartData);
    const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#00bcd4', '#ff7300', '#7cb342'];
    
    // Currency formatter with commas and 0 decimal places
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value ?? 0);
    }; 

    // Prepare Chart.js data structure
    const chartLabels = chartData.map(row => `Year ${row.Year}`);
    const chartDatasets = [];

    // Add individual account datasets
    accountValueKeys.forEach((key, index) => {
        chartDatasets.push({
            label: key.replace('_Value', ''),
            data: chartData.map(row => row[key] || 0),
            borderColor: CHART_COLORS[index % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[index % CHART_COLORS.length] + '40',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
        });
    });

    // Add Total Value line
    if (chartData.length > 0 && chartData[0].Total_Value !== undefined) {
        chartDatasets.push({
            label: 'Total Account Value',
            data: chartData.map(row => row.Total_Value || 0),
            borderColor: '#000000',
            backgroundColor: '#00000040',
            borderWidth: 3,
            pointRadius: 0,
            tension: 0.1,
        });
    }

    const chartJsData = {
        labels: chartLabels,
        datasets: chartDatasets,
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Projection Over Time',
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD' 
                            }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Value ($)',
                },
                ticks: {
                    callback: function(value) {
                        return new Intl.NumberFormat('en-US', { 
                            style: 'currency', 
                            currency: 'USD', 
                            minimumFractionDigits: 0 
                        }).format(value);
                    }
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Year',
                }
            }
        }
    };

    return (
        <div className="projection-detail-container">
            <header className="detail-header">
                <div>
                    <h1>{name}</h1>
                    <p>Projection Period: <strong>{years} Years</strong></p>
                </div>
                <button 
                    className="edit-btn"
                    onClick={() => {
                        navigate('/', { state: { editProjection: projection } });
                    }}
                >
                    Edit
                </button>
            </header>

            <div className="two-pane-layout">
                {/* Left Pane: Navigation and Summary */}
                <div className="left-pane">
                    <nav className="detail-nav">
                        <Link to="/" className="nav-link">New Projection</Link>
                        <Link to="/my-projections" className="nav-link">My Projections</Link>
                    </nav>

                    <section className="summary-cards">
                        <div className="card">
                            <h3>Final Value</h3>
                            <p>${final_value ? final_value.toLocaleString() : 'N/A'}</p>
                        </div>
                        <div className="card">
                            <h3>Total Contributions</h3>
                            <p>${total_contributed.toLocaleString()}</p>
                        </div>
                        <div className="card">
                            <h3>Total Growth (Interest)</h3>
                            <p>${total_growth.toLocaleString()}</p>
                        </div>
                    </section>
                </div>

                {/* Right Pane: Chart and Table */}
                <div className="right-pane">
                    <section className="chart-section">
                        <h2>Projection Over Time</h2>
                        <div style={{ height: '400px', width: '100%' }}>
                            <Line data={chartJsData} options={chartOptions} />
                        </div>
                    </section>

                    <section className="table-section">
                        <h2>Yearly Breakdown</h2>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Year</th>
                                    <th>Starting Value</th>
                                    {accountValueKeys.map(key => (
                                        <th key={key}>{key.replace('_Value', '')}</th>
                                    ))}
                                    <th>Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chartData.map(row => (
                                    <tr key={row.Year}>
                                        <td>{row.Year}</td>
                                        <td>{formatCurrency(row.StartingValue ?? row.Total_Value ?? 0)}</td>
                                        {accountValueKeys.map(key => (
                                            <td key={key}>
                                                {formatCurrency(row[key] ?? 0)}
                                            </td>
                                        ))}
                                        <td><strong>{formatCurrency(row.Value ?? row.Total_Value ?? 0)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>

        </div>
    );
};

export default ProjectionDetail;
