import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import all main components
import Header from './components/Header'; // A simple navigation bar
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Calculator from './components/Calculator'; // The core logic/form
import Dashboard from './components/Dashboard';   // The saved projections list
import ProjectionDetail from './components/ProjectionDetail';

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
                                    <Calculator /> {/* Default landing page */}
                                </ProtectedRoute>
                            }
                        />
                         <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard /> {/* List of saved plans */}
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/projection/:id"
                            element={
                                <ProtectedRoute>
                                    <ProjectionDetail /> {/* Individual projection view */}
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
