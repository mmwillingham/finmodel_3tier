import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import all main components (make sure these files exist!)
import Header from './components/Header'; 
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import SidebarLayout from './components/SidebarLayout';

// The Main Application Structure
function App() {
    return (
        <Router>
            {/* Wrap the entire app in the Auth Provider */}
            <AuthProvider>
                <Header />
                <main className="container">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />

                        {/* Protected Routes (Require JWT) */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <SidebarLayout />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/my-projections"
                            element={
                                <ProtectedRoute>
                                    <SidebarLayout />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </main>
            </AuthProvider>
        </Router>
    );
}

export default App;
