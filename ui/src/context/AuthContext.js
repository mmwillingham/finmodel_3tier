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
    const [viewingUserId, setViewingUserId] = useState(null); // null means view own data

    const navigate = useNavigate();

    // Function to check and load user session data
    const checkUserSession = async () => {
        const currentToken = AuthService.getToken();
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
                    // This error will be caught by the LoginPage component
                    throw new Error("Your email address has not been confirmed. Please check your inbox for a confirmation link.");
                }

            } catch (error) {
                AuthService.logout();
                setCurrentUser(null);
                setUserSettings(null);
                console.error("Error checking user session:", error);
            }
        }
        setIsLoading(false);
    };

    // Main login function, now handles credential exchange
    const login = async () => {
        setIsLoading(true);
        await checkUserSession();
    };

    const logout = () => {
        AuthService.logout();
        setCurrentUser(null);
        setUserSettings(null);
        navigate('/login');
    };
    
    useEffect(() => {
        checkUserSession();
    }, []);

    const refreshUserSettings = async () => {
        const token = AuthService.getToken(); // Get token from AuthService
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

    // Reset viewingUserId when user changes
    useEffect(() => {
        if (currentUser) {
            setViewingUserId(null); // Default to viewing own data
        }
    }, [currentUser]);

    const value = {
        currentUser,
        isLoading,
        login,
        logout,
        userSettings,
        refreshUserSettings, // Expose refresh function via context
        viewingUserId,
        setViewingUserId,
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
