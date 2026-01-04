import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { currentUser, isLoading } = useAuth();
    const location = useLocation();
    
    // The AuthProvider should handle the loading state, but a check here is safer
    if (isLoading) {
        return <div>Loading...</div>; 
    }

    // If there is no authenticated user, redirect them to the login page
    // Pass state to remember where we came from (for back button handling)
    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // Otherwise, render the component they requested (children)
    return children;
};

export default ProtectedRoute;
