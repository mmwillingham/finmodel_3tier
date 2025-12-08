import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'; // <--- NEW IMPORTS
import ProjectionService from '../services/projection.service';
import './ProjectionDetail.css';

const getAccountKeys = (data) => {
    if (!data || data.length === 0) return [];
    
    // Check all keys in the first data object
    const keys = Object.keys(data[0]);
    
    // Filter out the standard keys and return only the account value keys
    return keys.filter(key => key.endsWith('_Value'));
};

const ProjectionDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [projection, setProjection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
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

        if (id) {
            fetchProjection();
        } else {
            setError("No projection ID provided.");
            setLoading(false);
        }
    }, [id, navigate]);

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

// ----------------------------------------------------
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
                
                {/* * 🌟 START OF THE CHART IMPLEMENTATION 🌟
                  * This component uses the parsed chartData array
                  */}

                <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="Year" />
                        <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                        {/* Update Tooltip to show cleaner account names */}
                        <Tooltip formatter={(value, name) => [`$${value.toLocaleString()}`, name.replace('_Value', '')]} />
                        <Legend />
        
                        {/* Dynamic Lines for Each Account */}
                        {accountValueKeys.map((key, index) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={CHART_COLORS[index % CHART_COLORS.length]} // Cycle through colors
                                name={key.replace('_Value', '')} // Clean up the name for the legend
                                strokeWidth={2}
                                dot={false} // Use dots for individual accounts
                            />
                        ))}

                        {/* Total Value Line - This remains static and is useful for context */}
                        <Line 
                            type="monotone" 
                            dataKey="Total_Value" 
                            stroke="#000000" // Black for the total line
                            name="Total Account Value" 
                            strokeWidth={3} 
                            dot={false} 
                        />
                    </LineChart>
                </ResponsiveContainer>                {/* * 🌟 END OF THE CHART IMPLEMENTATION 🌟
                  */}
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
