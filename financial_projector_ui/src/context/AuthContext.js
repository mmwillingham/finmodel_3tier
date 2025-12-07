import React, { createContext, useContext, useState, useEffect } from 'react';
import AuthService from '../services/auth.service';
import ApiService from '../services/api.service'; // Needed to fetch /users/me

// 1. Create the Context object
const AuthContext = createContext();

// 2. Custom hook to easily consume the context
export const useAuth = () => {
    return useContext(AuthContext);
};

// 3. The Provider component manages state and provides it to the app
export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Tracks initial token check

    // Function to check local storage and fetch user details
    const checkUserSession = async () => {
        const token = AuthService.getToken();
        if (token) {
            try {
                // Use the token to fetch the user's details from the protected endpoint
                // ApiService handles placing the token in the Authorization header
                const userResponse = await ApiService.get("/users/me");
                
                // Set the user data from the successful response
                setCurrentUser(userResponse.data);
            } catch (error) {
                // Token is invalid/expired (401 Unauthorized), so clear it
                AuthService.logout();
                setCurrentUser(null);
            }
        }
        setIsLoading(false);
    };

    // The 'login' function is called *after* AuthService.login has successfully saved the token.
    const login = async () => {
        // We only call this function to update the app state after a successful POST /token
        setIsLoading(true);
        await checkUserSession(); // This will read the newly saved token and fetch /users/me
    };

    const logout = () => {
        AuthService.logout();
        setCurrentUser(null);
        navigate('/login'); // Optional: redirect on logout if necessary
    };
    
    // Check for a saved token when the application first loads
    useEffect(() => {
        checkUserSession();
    }, []);

    // The object that will be exposed to consumers
    const value = {
        currentUser,
        isLoading,
        login, // Function to trigger state update after successful login POST
        logout,
    };

    // 4. Provide the value to the application children
    return (
        <AuthContext.Provider value={value}>
            {/* We prevent rendering the children until the initial 
                token check is complete (isLoading is false). 
                This prevents flash-of-unauthenticated-content (FOUC) errors. 
            */}
            {!isLoading && children}
        </AuthContext.Provider>
    );
};
