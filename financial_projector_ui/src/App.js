import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import all main components (make sure these files exist!)
import Header from './components/Header'; 
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import Calculator from './components/Calculator'; 
import Dashboard from './components/Dashboard';   
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
