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
                // Call the correct service method which now returns the clean data payload
                const data = await ProjectionService.getProjectionDetails(id); 
                
                // Set the state directly with the clean data object
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

    // 3. Destructure properties safely using || {}
    // This prevents "Cannot read properties of undefined" during the initial render
    const { 
        name, 
        years, 
        final_value, 
        data_json,
        // Assuming these two fields are also part of your final ProjectionResponse schema
        total_contributed = 0, // Initialize totals with 0
        total_growth = 0
    } = projection || {}; 
    
    // --- Render Logic with State Checks ---

    if (loading) {
        return <div className="loading-state">Loading projection data...</div>;
    }

    if (error) {
        return <div className="error-state">{error}</div>;
    }

    // Since loading is false and error is null, we must have data.
    // If projection is still null here, something is wrong with the data, so we show the error.
    if (!projection) {
         return <div className="error-state">No projection data available.</div>;
    }

    // Now, it's safe to render the main content using the destructured properties.
    // We assume data_json is a JSON string of records and needs to be parsed for display.
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
                    {/* CRITICAL: total_contributed must exist on your schema */}
                    <p>${total_contributed.toLocaleString()}</p>
                </div>
                <div className="card">
                    <h3>Total Growth (Interest)</h3>
                    <p>${total_growth.toLocaleString()}</p>
                </div>
            </section>

            <section className="chart-section">
                <h2>Projection Over Time</h2>
                {/* * Placeholder for a Chart Component (e.g., using D3, Chart.js, or Recharts) 
                  * You would typically map the chartData here.
                  */}
                <div className="chart-placeholder">
                    

[Image of a line chart showing investment growth over 25 years]

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
                                <td>${row
