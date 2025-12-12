import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import ApiService from '../services/api.service';
import SettingsService from '../services/settings.service';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userSettings, setUserSettings] = useState(null);

    const navigate = useNavigate();

    const checkUserSession = async () => {
        const token = AuthService.getToken();
        if (token) {
            try {
                const userResponse = await AuthService.getCurrentUser();
                setCurrentUser(userResponse);
                
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);
                console.log('Fetched user settings in AuthContext:', settingsResponse.data);

            } catch (error) {
                AuthService.logout();
                setCurrentUser(null);
                setUserSettings(null);
            }
        }
        setIsLoading(false);
    };

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

    const value = {
        currentUser,
        isLoading,
        login,
        logout,
        userSettings,
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
