import React, { useState, useEffect, createContext, useContext } from 'react';
import AuthService from '../services/auth.service';
import ApiService from '../services/api.service'; // Needed to fetch current user data

// 1. Create the Context
const AuthContext = createContext(null);

// 2. Custom hook for easy access to the context
export const useAuth = () => {
    return useContext(AuthContext);
};

// 3. The Provider Component
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Function to handle the successful login (stores user data and token)
    const handleLoginSuccess = async (token) => {
        // 1. Store the token in local storage (handled by AuthService)
        // 2. Fetch the user's detailed profile from the secure endpoint
        try {
            // This GET request uses the token attached by api.service.js
            const response = await ApiService.api.get('users/me'); 
            setCurrentUser(response.data);
            setIsLoading(false);
        } catch (error) {
            console.error("Failed to fetch user profile:", error);
            AuthService.logout(); // Clear token if profile fetch fails
            setCurrentUser(null);
            setIsLoading(false);
        }
    };

    // Function to handle logout
    const handleLogout = () => {
        AuthService.logout();
        setCurrentUser(null);
        setIsLoading(false);
    };

    // Effect: Runs once when the component mounts to check for an existing session
    useEffect(() => {
        const token = AuthService.getCurrentToken();
        if (token) {
            // If token exists, validate it by fetching user profile
            handleLoginSuccess(token);
        } else {
            setIsLoading(false);
        }
    }, []);

    const value = {
        currentUser,
        isLoading,
        login: handleLoginSuccess, // Expose the successful login handler
        logout: handleLogout
    };

    if (isLoading) {
        return <div className="loading-screen">Loading application...</div>;
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
