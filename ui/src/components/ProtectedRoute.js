import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { currentUser, isLoading } = useAuth();
    
    // The AuthProvider should handle the loading state, but a check here is safer
    if (isLoading) {
        return <div>Loading...</div>; 
    }

    // If there is no authenticated user, redirect them to the login page
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // Otherwise, render the component they requested (children)
    return children;
};

export default ProtectedRoute;
