import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import ProjectionService from "../services/projection.service";
import { generateChartData, chartOptions } from '../utils/ChartConfig';
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

const ProjectionDetail = () => {
    const { id } = useParams(); // Get the projection ID from the URL
    const navigate = useNavigate();
    
    const [projection, setProjection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Effect ---
    
    useEffect(() => {
        // 1. Get ID from URL params (assuming you use useParams or similar)
        // const { id } = useParams(); // Or whatever method you use
    
        const fetchProjection = async () => {
            try {
                // CRITICAL: Call the correct service method
                const data = await ProjectionService.getProjectionDetails(id); 
            
                // Set the state directly with the clean data object
                setProjection(data); 
                
                setLoading(false);
                setError(null);
            
            } catch (error) {
                console.error("Error fetching projection:", error);
                // This is the line that triggers the visible error message
            setError("Error loading projection. It may not exist or you lack access."); 
            setLoading(false);
            }
        };

        if (id) {
            fetchProjection();
        }
    }, [id]);

    // --- Delete Handler ---
    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to permanently delete this projection?")) {
            try {
                await ApiService.deleteProjection(id);
                // Redirect user to the dashboard after successful deletion
                navigate('/dashboard');
            } catch (err) {
                alert("Failed to delete projection. Please try again.");
                console.error("Delete Error:", err);
            }
        }
    };

    if (loading) return <div className="detail-loading">Loading Projection Data...</div>;
    if (error) return <div className="detail-error">{error}</div>;
    if (!projection) return <div className="detail-error">No data available.</div>;

    // --- Data Preparation ---
    const finalValue = projection.final_value;
    const totalContributed = projection.projection_data.total_contributed;
    const chartData = generateChartData(projection.projection_data);
    const chartConfigOptions = chartOptions(finalValue);
    const yearlyTableData = projection.projection_data.yearly_data;
    
    // Calculate Interest Earned
    const interestEarned = finalValue - totalContributed;
    const interestRatio = totalContributed > 0 ? (interestEarned / totalContributed) * 100 : 0;

    // Helper for currency formatting
    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

    return (
        <div className="projection-detail-page">
            <div className="header-actions">
                <h1>{projection.name} ({projection.years} Years)</h1>
                <button onClick={handleDelete} className="delete-btn">
                    🗑️ Delete Plan
                </button>
            </div>
            
            {/* Key Metrics */}
            <div className="metrics-summary">
                <div className="metric-box">
                    <span>💰 Final Portfolio Value</span>
                    <strong>{formatCurrency(finalValue)}</strong>
                </div>
                <div className="metric-box">
                    <span>💵 Total Contributions</span>
                    <strong>{formatCurrency(totalContributed)}</strong>
                </div>
                <div className="metric-box interest-box">
                    <span>📈 Total Interest Earned</span>
                    <strong>{formatCurrency(interestEarned)}</strong>
                    <p>{interestRatio.toFixed(1)}% Return</p>
                </div>
            </div>

            {/* Chart Area */}
            <div className="chart-container">
                <Line data={chartData} options={chartConfigOptions} />
            </div>

            {/* Yearly Table */}
            <h2>Yearly Breakdown</h2>
            <div className="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Year</th>
                            {Object.keys(yearlyTableData).filter(key => key !== 'Year').map(key => (
                                <th key={key}>{key.replace(' Balance', '')}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {yearlyTableData.Year.map((year, index) => (
                            <tr key={year}>
                                <td>{year}</td>
                                {Object.keys(yearlyTableData).filter(key => key !== 'Year').map(key => (
                                    <td key={key}>{formatCurrency(yearlyTableData[key][index])}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProjectionDetail;
