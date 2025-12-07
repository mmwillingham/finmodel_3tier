import React, { useState, useEffect } from 'react';
import ApiService from '../services/api.service';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [projections, setProjections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchProjections = async () => {
        try {
            setLoading(true);
            const response = await ApiService.getProjectionsSummary(); // GET /projections
            setProjections(response.data);
            setLoading(false);
        } catch (err) {
            setError("Failed to load dashboard data.");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjections();
    }, []);

    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    
    if (loading) return <div>Loading Dashboard...</div>;
    if (error) return <div className="dashboard-error">{error}</div>;

    return (
        <div className="dashboard-page">
            <h1>📚 Saved Financial Projections</h1>
            {projections.length === 0 ? (
                <p>No projections saved yet. Go to the Calculator to create one!</p>
            ) : (
                <table className="projections-table">
                    <thead>
                        <tr>
                            <th>Plan Name</th>
                            <th>Years</th>
                            <th>Total Contributed</th>
                            <th>Final Value</th>
                            <th>Date Saved</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projections.map(proj => (
                            <tr key={proj.id}>
                                <td>{proj.name}</td>
                                <td>{proj.years}</td>
                                <td>{formatCurrency(proj.total_contributed)}</td>
                                <td>{formatCurrency(proj.final_value)}</td>
                                <td>{new Date(proj.timestamp).toLocaleDateString()}</td>
                                <td>
                                    <button 
                                        onClick={() => navigate(`/projection/${proj.id}`)}
                                        className="view-btn"
                                    >
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default Dashboard;
