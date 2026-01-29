import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import SettingsService from '../services/settings.service';
import AuthorizedUsersService from '../services/authorizedUsers.service';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userSettings, setUserSettings] = useState(null);
    const [viewingUserId, setViewingUserId] = useState(null);

    const navigate = useNavigate();
    const location = useLocation();
    const isFirstMount = useRef(true);

    const handleSetViewingUserId = (userId) => {
        setViewingUserId(userId);
        if (userId === null) {
            localStorage.removeItem('viewingUserId');
        } else {
            localStorage.setItem('viewingUserId', userId.toString());
        }
    };

    const logout = () => {
        AuthService.logout();
        setCurrentUser(null);
        setUserSettings(null);
        setViewingUserId(null);
        if (!['/login', '/signup', '/confirm-email'].includes(location.pathname)) {
            navigate('/login');
        }
    };

    const checkUserSession = async () => {
        try {
            const token = AuthService.getToken();
            if (!token) {
                setIsLoading(false);
                return;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Change this line in checkUserSession
            if (response.ok) {
                const userData = await response.json();
                setCurrentUser(userData);
                // ... load settings
            } else {
                // INSTEAD of calling logout() which contains a navigate()
                // just clear the state. Let the Router handle the redirection.
                AuthService.logout(); 
                setCurrentUser(null);
            }
        } catch (error) {
            console.error("Session check error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { checkUserSession(); }, []);

    useEffect(() => {
        if (currentUser?.id) {
            const savedId = localStorage.getItem('viewingUserId');
            if (isFirstMount.current) {
                if (savedId) {
                    const parsedId = parseInt(savedId);
                    if (!isNaN(parsedId) && parsedId !== currentUser.id) {
                        setViewingUserId(parsedId);
                    }
                }
                isFirstMount.current = false;
            }
        }
    }, [currentUser?.id]);

    const value = {
        currentUser, isLoading, userSettings, viewingUserId,
        setViewingUserId: handleSetViewingUserId,
        refreshUserSettings: async () => {
            const s = await SettingsService.getSettings();
            setUserSettings(s);
        },
        login: async (e, p) => {
            const d = await AuthService.login(e, p);
            if (d?.access_token) await checkUserSession();
            return d;
        },
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {/* STABILITY FIX: We keep the Provider mounted and only show children when ready */}
            {isLoading ? (
                <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-white">
                    <p>Authenticating...</p>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};