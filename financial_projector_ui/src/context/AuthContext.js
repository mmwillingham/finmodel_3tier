import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // <--- ADDED FOR FIX
import AuthService from '../services/auth.service';
import ApiService from '../services/api.service';

// 1. Create the Context object
const AuthContext = createContext();

// 2. Custom hook to easily consume the context
export const useAuth = () => {
    return useContext(AuthContext);
};

// 3. The Provider component manages state and provides it to the app
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // CRITICAL FIX: Get the navigate function here
    const navigate = useNavigate();

    // Function to check local storage and fetch user details
    const checkUserSession = async () => {
        const token = AuthService.getToken();
        if (token) {
            try {
                // This call uses api.service.js which includes the token
                const userResponse = await ApiService.get("/users/me");
                
                setCurrentUser(userResponse.data);
            } catch (error) {
                // If token is invalid or expired, clear it and set state to null
                AuthService.logout();
                setCurrentUser(null);
            }
        }
        setIsLoading(false);
    };

    // The 'login' function is called *after* AuthService.login has successfully saved the token.
    const login = async () => {
        setIsLoading(true);
        // This will read the newly saved token, fetch /users/me, and update currentUser
        await checkUserSession(); 
    };

    const logout = () => {
        AuthService.logout();
        setCurrentUser(null);
        // This is the line that required the useNavigate fix
        navigate('/login'); 
    };
    
    // Check for a saved token when the application first loads
    useEffect(() => {
        checkUserSession();
    }, []);

    const value = {
        currentUser,
        isLoading,
        login, 
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {/* Prevent rendering until the initial token check is complete */}
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
