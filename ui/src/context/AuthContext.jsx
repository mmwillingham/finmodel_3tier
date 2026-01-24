import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/auth.service';
import SettingsService from '../services/settings.service';
import AuthorizedUsersService from '../services/authorizedUsers.service';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userSettings, setUserSettings] = useState(null);
    // Load viewingUserId from localStorage on mount, default to null
    // Only load if it's different from currentUser.id (which we'll check in useEffect)
    const [viewingUserId, setViewingUserId] = useState(null); // Always start with null, check localStorage in useEffect

    const navigate = useNavigate();
    
    // Save viewingUserId to localStorage whenever it changes
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

    // Function to check and load user session data
    const checkUserSession = async () => {
        const currentToken = AuthService.getToken();
        if (currentToken) {
            try {
                const userResponse = await AuthService.getCurrentUser();
                setCurrentUser(userResponse);
                
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);

                // NEW: Check email confirmation status here (only if user has email)
                if (userResponse.email && !userResponse.is_confirmed) {
                    AuthService.logout();
                    setCurrentUser(null);
                    setUserSettings(null);
                    // This error will be caught by the LoginPage component
                    throw new Error("Your email address has not been confirmed. Please check your inbox for a confirmation link.");
                }

                // NEW: Check if user has received authorized access and has no data
                // If so, automatically switch to the authorizing user's data
                try {
                    const AuthorizedUsersService = (await import('../services/authorizedUsers.service')).default;
                    const receivedAccess = await AuthorizedUsersService.listReceivedAccess();
                    if (receivedAccess && receivedAccess.length > 0) {
                        // Check if user has any data of their own
                        const AssetService = (await import('../services/asset.service')).default;
                        const CashFlowService = (await import('../services/cashflow.service')).default;
                        const [assetsRes, incomeRes, expenseRes] = await Promise.all([
                            AssetService.list(null).catch(() => ({ data: [] })),
                            CashFlowService.list(true, null).catch(() => ({ data: [] })),
                            CashFlowService.list(false, null).catch(() => ({ data: [] }))
                        ]);
                        
                        const hasOwnData = (assetsRes.data && assetsRes.data.length > 0) ||
                                         (incomeRes.data && incomeRes.data.length > 0) ||
                                         (expenseRes.data && expenseRes.data.length > 0);
                        
                        // If user has no data and has received access, switch to the first authorizing user
                        if (!hasOwnData && receivedAccess.length > 0) {
                            const firstAccess = receivedAccess[0];
                            if (firstAccess.primary_user_id) {
                                setViewingUserId(firstAccess.primary_user_id);
                                localStorage.setItem('viewingUserId', firstAccess.primary_user_id.toString());
                            }
                        }
                    }
                } catch (err) {
                    // Don't fail login if this check fails
                }

            } catch (error) {
                AuthService.logout();
                setCurrentUser(null);
                setUserSettings(null);
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
        // Clear viewingUserId and all session markers on logout
        setViewingUserId(null);
        // Clear all session markers
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
        const token = AuthService.getToken(); // Get token from AuthService
        if (token) {
            try {
                const settingsResponse = await SettingsService.getSettings();
                setUserSettings(settingsResponse.data);
            } catch (error) {
            }
        }
    };

    // Reset viewingUserId to null (own account) every time user logs in (user ID changes)
    // This ensures users always start viewing their own account on login,
    // regardless of what was saved in the previous session
    // Users can still switch accounts during the session, but it will reset on next login
    const previousUserIdRef = useRef(null);
    useEffect(() => {
        if (currentUser) {
            const currentUserId = currentUser.id;
            const sessionKey = `session_user_${currentUserId}`;
            const lastSessionUserId = localStorage.getItem(sessionKey);
            
            // Check if this is a new login (user ID changed) or new session
            const isNewLogin = previousUserIdRef.current !== null && previousUserIdRef.current !== currentUserId;
            const isNewSession = lastSessionUserId !== currentUserId.toString();
            
                currentUserId,
                previousUserIdRef: previousUserIdRef.current,
                lastSessionUserId,
                isNewLogin,
                isNewSession,
                savedViewingUserId: localStorage.getItem('viewingUserId')
            });
            
            if (isNewLogin || isNewSession) {
                // User ID changed OR new session - this is a fresh login
                // Reset to own account on login
                setViewingUserId(null);
                // Clear any saved viewingUserId preference from previous session
                localStorage.removeItem('viewingUserId');
                // Mark this as the current session
                localStorage.setItem(sessionKey, currentUserId.toString());
                // Update the ref to track the current user ID
                previousUserIdRef.current = currentUserId;
            } else if (!isNewSession && previousUserIdRef.current === null) {
                // Same session, but refs reset due to page reload - restore from localStorage
                // This handles page reloads within the same session
                const saved = localStorage.getItem('viewingUserId');
                if (saved) {
                    const savedId = parseInt(saved);
                    if (savedId && savedId !== currentUserId) {
                        // User switched accounts in this session - restore it
                        setViewingUserId(savedId);
                    } else {
                        // Invalid or own account - reset to null
                        setViewingUserId(null);
                        localStorage.removeItem('viewingUserId');
                    }
                } else {
                    // No saved value - default to own account
                    setViewingUserId(null);
                }
                // Update refs
                previousUserIdRef.current = currentUserId;
            } else if (previousUserIdRef.current === null) {
                // First time initializing in this session - check if there's a saved viewingUserId
                // If there is and it's different from current user, preserve it (user switched accounts)
                // Otherwise, default to own account
                const saved = localStorage.getItem('viewingUserId');
                if (saved) {
                    const savedId = parseInt(saved);
                    if (savedId && savedId !== currentUserId) {
                        // User switched accounts in this session - preserve it
                        setViewingUserId(savedId);
                        // Mark this as the current session AFTER setting viewingUserId
                        localStorage.setItem(sessionKey, currentUserId.toString());
                        previousUserIdRef.current = currentUserId;
                        // Return early to prevent further execution
                        return;
                    } else {
                        // Invalid or own account - reset to null
                        setViewingUserId(null);
                        localStorage.removeItem('viewingUserId');
                    }
                } else {
                    // No saved value - default to own account
                    setViewingUserId(null);
                }
                // Mark this as the current session
                localStorage.setItem(sessionKey, currentUserId.toString());
                previousUserIdRef.current = currentUserId;
            } else {
                // Already initialized - check if viewingUserId needs to be synchronized with localStorage
                // Only restore if state is null but localStorage has a value
                // Don't reset it if it's already set correctly
                const saved = localStorage.getItem('viewingUserId');
                if (saved) {
                    const savedId = parseInt(saved);
                    if (savedId && savedId !== currentUserId) {
                        // localStorage has a switched account saved
                        if (viewingUserId === null || viewingUserId !== savedId) {
                            // State doesn't match localStorage - restore from localStorage
                            setViewingUserId(savedId);
                        } else {
                        }
                    } else {
                        // Invalid saved value - clear it
                        if (savedId === currentUserId) {
                            localStorage.removeItem('viewingUserId');
                            if (viewingUserId !== null) {
                                setViewingUserId(null);
                            }
                        }
                    }
                } else {
                    // No saved value in localStorage
                    if (viewingUserId !== null && viewingUserId !== currentUserId) {
                        // State has a switched account but localStorage doesn't - this shouldn't happen
                        // Clear the state to match localStorage
                        setViewingUserId(null);
                    } else {
                    }
                }
            }
            // If already initialized and user ID hasn't changed, don't reset viewingUserId
            // (preserve account switch during session)
        }
    }, [currentUser?.id]); // Only depend on currentUser.id, not the whole currentUser object

    const value = {
        currentUser,
        isLoading,
        login,
        logout,
        userSettings,
        refreshUserSettings, // Expose refresh function via context
        viewingUserId,
        setViewingUserId: handleSetViewingUserId, // Use wrapper function that saves to localStorage
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
