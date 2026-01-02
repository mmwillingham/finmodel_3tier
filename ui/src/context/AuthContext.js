import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import SettingsService from '../services/settings.service';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userSettings, setUserSettings] = useState(null);
    const [token, setToken] = useState(AuthService.getToken()); // Store token in state

    const navigate = useNavigate();

    // Function to check and load user session data
    const checkUserSession = async () => {
        const currentToken = AuthService.getToken();
        setToken(currentToken);
        if (currentToken) {
            try {
                const userResponse = await AuthService.getCurrentUser();
                setCurrentUser(userResponse);
                console.log('DEBUG (AuthContext): userResponse after getCurrentUser:', userResponse); // NEW DEBUG LOG
                
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);
                console.log('Fetched user settings in AuthContext:', settingsResponse.data);

                // NEW: Check email confirmation status here
                if (!userResponse.is_confirmed) {
                    AuthService.logout();
                    setCurrentUser(null);
                    setUserSettings(null);
                    setToken(null);
                    // This error will be caught by the LoginPage component
                    throw new Error("Your email address has not been confirmed. Please check your inbox for a confirmation link.");
                }

            } catch (error) {
                AuthService.logout();
                setCurrentUser(null);
                setUserSettings(null);
                setToken(null);
                console.error("Error checking user session:", error);
            }
        }
        setIsLoading(false);
    };

    // Main login function, now handles credential exchange
    const login = async (email, password) => {
        setIsLoading(true);
        try {
            await AuthService.login(email, password); // Exchange credentials for token
            await checkUserSession(); // Then check session to load user data
        } catch (error) {
            setIsLoading(false);
            AuthService.logout(); // Ensure token is cleared on login failure
            setToken(null);
            setCurrentUser(null);
            setUserSettings(null);
            throw error; // Re-throw to be caught by LoginPage for error display
        }
    };

    const logout = () => {
        AuthService.logout();
        setCurrentUser(null);
        setUserSettings(null);
        setToken(null);
        navigate('/login');
    };
    
    useEffect(() => {
        checkUserSession();
    }, []);

    const refreshUserSettings = async () => {
        if (token) {
            try {
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);
                console.log('Refreshed user settings in AuthContext:', settingsResponse.data);
            } catch (error) {
                console.error("Error refreshing user settings:", error);
            }
        }
    };

    const value = {
        currentUser,
        isLoading,
        login,
        logout,
        userSettings,
        token, // Provide token via context for GlobalSettings.jsx
        refreshUserSettings, // Expose refresh function via context
        checkUserSession, // Expose checkUserSession for GoogleAuthCallback
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
