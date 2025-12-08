import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProjectionService from '../services/projection.service'; // Corrected import path
import './ProjectionDetail.css'; // Assuming you have a CSS file

const ProjectionDetail = () => {
    // 1. Get the projection ID from the URL
    const { id } = useParams();
    const navigate = useNavigate();

    // 2. Initialize state safely: projection is null until loaded
    const [projection, setProjection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch data when the component mounts or the ID changes
    useEffect(() => {
        const fetchProjection = async () => {
            setLoading(true);
            setError(null);
            
            try {
                // Call the service method which now returns the clean data payload
                const data = await ProjectionService.getProjectionDetails(id); 
                
                setProjection(data); 

            } catch (err) {
                console.error("Error fetching projection:", err);
                // Handle 404/403 errors returned by the service
                if (err.response && (err.response.status === 404 || err.response.status === 403)) {
                    setError("Error loading projection. It may not exist or you lack access.");
                } else {
                    setError("An unexpected error occurred while fetching data.");
                }
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchProjection();
        } else {
            setError("No projection ID provided.");
            setLoading(false);
        }
    }, [id, navigate]);

    // 3. Destructure properties safely using || {} to prevent "Cannot read properties of undefined"
    const { 
        name, 
        years, 
        final_value, 
        data_json,
        total_contributed = 0, 
        total_growth = 0
    } = projection || {}; 
    
    // --- Render Logic with State Checks ---

    if (loading) {
        return <div className="loading-state">Loading projection data...</div>;
    }

    if (error) {
        return <div className="error-state">{error}</div>;
    }

    if (!projection) {
         return <div className="error-state">No projection data available.</div>;
    }

    const chartData = data_json ? JSON.parse(data_json) : [];

    return (
        <div className="projection-detail-container">
            <header className="detail-header">
                <h1>{name}</h1>
                <p>Projection Period: **{years} Years**</p>
            </header>

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

            <section className="chart-section">
                <h2>Projection Over Time</h2>
                

[Image of a line chart showing investment growth over 25 years]

                <div className="chart-placeholder">
                    <p>Financial Chart Component goes here, using data from the {name} projection.</p>
                </div>
            </section>

            <section className="table-section">
                <h2>Yearly Breakdown</h2>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Year</th>
                            <th>Starting Value</th>
                            <th>Contributions</th>
                            <th>Growth</th>
                            <th>Ending Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chartData.map(row => (
                            <tr key={row.Year}>
                                <td>{row.Year}</td>
                                <td>${row.StartingValue.toFixed(2)}</td>
                                <td>${row.Contributions.toFixed(2)}</td>
                                <td>${row.Growth.toFixed(2)}</td>
                                <td>**${row.Value.toFixed(2)}**</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

        </div>
    );
};

export default ProjectionDetail;
