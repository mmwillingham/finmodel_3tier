import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import SettingsService from '../services/settings.service';
import AuthorizedUsersService from '../services/authorizedUsers.service';
import AssetService from '../services/asset.service';
import CashFlowService from '../services/cashflow.service';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userSettings, setUserSettings] = useState(null);
    const [viewingUserId, setViewingUserId] = useState(null);

    const navigate = useNavigate();
    
    const handleSetViewingUserId = (userId) => {
        setViewingUserId(userId);
        try {
            if (userId === null) {
                localStorage.removeItem('viewingUserId');
            } else {
                localStorage.setItem('viewingUserId', userId.toString());
            }
        } catch (error) {
        }
    };

    const checkUserSession = async () => {
        const currentToken = AuthService.getToken();
        if (currentToken) {
            try {
                const userResponse = await AuthService.getCurrentUser();
                setCurrentUser(userResponse);
                
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);

                if (userResponse.email && !userResponse.is_confirmed) {
                    AuthService.logout();
                    setCurrentUser(null);
                    setUserSettings(null);
                    throw new Error("Your email address has not been confirmed. Please check your inbox for a confirmation link.");
                }

                // Standardized: Using static imports instead of dynamic await imports
                try {
                    const receivedAccess = await AuthorizedUsersService.listReceivedAccess();
                    if (receivedAccess && receivedAccess.length > 0) {
                        const [assetsRes, incomeRes, expenseRes] = await Promise.all([
                            AssetService.list(null).catch(() => ({ data: [] })),
                            CashFlowService.list(true, null).catch(() => ({ data: [] })),
                            CashFlowService.list(false, null).catch(() => ({ data: [] }))
                        ]);
                        
                        const hasOwnData = (assetsRes.data && assetsRes.data.length > 0) ||
                                         (incomeRes.data && incomeRes.data.length > 0) ||
                                         (expenseRes.data && expenseRes.data.length > 0);
                        
                        if (!hasOwnData && receivedAccess.length > 0) {
                            const firstAccess = receivedAccess[0];
                            if (firstAccess.primary_user_id) {
                                setViewingUserId(firstAccess.primary_user_id);
                                localStorage.setItem('viewingUserId', firstAccess.primary_user_id.toString());
                            }
                        }
                    }
                } catch (err) {
                    // Silently fail if data check fails
                }

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
        setViewingUserId(null);
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (key.startsWith('session_user_')) {
                localStorage.removeItem(key);
            }
        });
        localStorage.removeItem('viewingUserId');
        navigate('/login');
    };
    
    useEffect(() => {
        checkUserSession();
    }, []);

    const refreshUserSettings = async () => {
        const token = AuthService.getToken();
        if (token) {
            try {
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);
            } catch (error) {
            }
        }
    };

    const previousUserIdRef = useRef(null);
    useEffect(() => {
        if (currentUser) {
            const currentUserId = currentUser.id;
            const sessionKey = `session_user_${currentUserId}`;
            const lastSessionUserId = localStorage.getItem(sessionKey);
            
            const isNewLogin = previousUserIdRef.current !== null && previousUserIdRef.current !== currentUserId;
            const isNewSession = lastSessionUserId !== currentUserId.toString();

            if (isNewLogin || isNewSession) {
                setViewingUserId(null);
                localStorage.removeItem('viewingUserId');
                localStorage.setItem(sessionKey, currentUserId.toString());
                previousUserIdRef.current = currentUserId;
            } else if (!isNewSession && previousUserIdRef.current === null) {
                const saved = localStorage.getItem('viewingUserId');
                if (saved) {
                    const savedId = parseInt(saved);
                    if (savedId && savedId !== currentUserId) {
                        setViewingUserId(savedId);
                    } else {
                        setViewingUserId(null);
                        localStorage.removeItem('viewingUserId');
                    }
                } else {
                    setViewingUserId(null);
                }
                previousUserIdRef.current = currentUserId;
            } else if (previousUserIdRef.current === null) {
                const saved = localStorage.getItem('viewingUserId');
                if (saved) {
                    const savedId = parseInt(saved);
                    if (savedId && savedId !== currentUserId) {
                        setViewingUserId(savedId);
                        localStorage.setItem(sessionKey, currentUserId.toString());
                        previousUserIdRef.current = currentUserId;
                        return;
                    } else {
                        setViewingUserId(null);
                        localStorage.removeItem('viewingUserId');
                    }
                } else {
                    setViewingUserId(null);
                }
                localStorage.setItem(sessionKey, currentUserId.toString());
                previousUserIdRef.current = currentUserId;
            } else {
                const saved = localStorage.getItem('viewingUserId');
                if (saved) {
                    const savedId = parseInt(saved);
                    if (savedId && savedId !== currentUserId) {
                        if (viewingUserId === null || viewingUserId !== savedId) {
                            setViewingUserId(savedId);
                        }
                    } else {
                        if (savedId === currentUserId) {
                            localStorage.removeItem('viewingUserId');
                            if (viewingUserId !== null) {
                                setViewingUserId(null);
                            }
                        }
                    }
                } else {
                    if (viewingUserId !== null && viewingUserId !== currentUserId) {
                        setViewingUserId(null);
                    }
                }
            }
        }
    }, [currentUser?.id]);

    const value = {
        currentUser,
        isLoading,
        login,
        logout,
        userSettings,
        refreshUserSettings,
        viewingUserId,
        setViewingUserId: handleSetViewingUserId,
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};