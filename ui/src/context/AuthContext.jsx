import React, { createContext, useContext, useState, useEffect } from 'react';
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
    const [viewingUserId, setViewingUserId] = useState(() => {
        try {
            const saved = localStorage.getItem('viewingUserId');
            return saved ? parseInt(saved) : null;
        } catch {
            return null;
        }
    });

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
            console.error('Error saving viewingUserId to localStorage:', error);
        }
    };

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

                // NEW: Check email confirmation status here (only if user has email)
                if (userResponse.email && !userResponse.is_confirmed) {
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

    // Reset viewingUserId when user changes (but keep saved preference if valid)
    // Also automatically switch to authorized account for view-only users
    useEffect(() => {
        if (currentUser) {
            const checkAndSetViewingUser = async () => {
                try {
                    const saved = localStorage.getItem('viewingUserId');
                    // Only use saved value if it's different from current user's ID
                    // If viewing own account or no saved value, use null
                    if (saved && parseInt(saved) !== currentUser.id) {
                        setViewingUserId(parseInt(saved));
                    } else {
                        // Check if user has received access (is authorized to view other users' data)
                        try {
                            const receivedAccess = await AuthorizedUsersService.listReceivedAccess();
                            
                            if (receivedAccess && receivedAccess.length > 0) {
                                // Find the first primary user with non-documents permissions
                                // (users with only documents permission shouldn't appear in the main view)
                                const firstPrimaryUser = receivedAccess.find(access => {
                                    return access.items_permission || 
                                           access.accounts_permission || 
                                           access.projections_permission || 
                                           access.charts_permission;
                                });
                                
                                if (firstPrimaryUser && firstPrimaryUser.primary_user_id) {
                                    // Automatically set viewingUserId to the first authorized primary user
                                    // This handles Situation 2: view-only users who don't have their own data
                                    console.log(`Auto-switching to authorized account: ${firstPrimaryUser.primary_user_id}`);
                                    setViewingUserId(firstPrimaryUser.primary_user_id);
                                    localStorage.setItem('viewingUserId', firstPrimaryUser.primary_user_id.toString());
                                } else {
                                    // No non-documents permissions, stay on own account
                                    setViewingUserId(null);
                                    localStorage.removeItem('viewingUserId');
                                }
                            } else {
                                // No received access, stay on own account
                                setViewingUserId(null);
                                localStorage.removeItem('viewingUserId');
                            }
                        } catch (error) {
                            console.error('Error checking received access:', error);
                            // On error, default to own account
                            setViewingUserId(null);
                            localStorage.removeItem('viewingUserId');
                        }
                    }
                } catch {
                    setViewingUserId(null);
                }
            };
            
            checkAndSetViewingUser();
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
        setViewingUserId: handleSetViewingUserId, // Use wrapper function that saves to localStorage
    };

    return (
        <AuthContext.Provider value={value}>
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
