import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import NavigationGuard from './components/NavigationGuard';

// Import all main components
import Header from './components/Header'; 
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import SidebarLayout from './components/SidebarLayout';
import ResetPasswordPage from './components/ResetPasswordPage';
import EmailConfirmationPage from './components/EmailConfirmationPage';
import GoogleAuthCallback from './components/GoogleAuthCallback';

// Import new settings pages
import ApplicationSettingsPage from './pages/ApplicationSettingsPage.jsx';
import ProfileSettingsPage from './pages/ProfileSettingsPage.jsx';
import CategorySettingsPage from './pages/CategorySettingsPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import DefaultCategoriesPage from './pages/DefaultCategoriesPage.jsx';
import HelpPage from './pages/HelpPage.jsx';

// The Main Application Structure
function App() {
    return (
        <Router>
            {/* Wrap the entire app in the Auth Provider */}
            <AuthProvider>
                <NavigationGuard>
                    <Header /> {/* Removed setIsSettingsModalOpen prop */}
                    <main className="container">
                        <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/confirm-email" element={<EmailConfirmationPage />} />
                        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

                        {/* Protected Routes (Require JWT) */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <SidebarLayout />
                                </ProtectedRoute>
                            }
                        />
                        
                        {/* New Protected Settings Routes */}
                        <Route path="/settings/application" element={<ProtectedRoute><ApplicationSettingsPage /></ProtectedRoute>} />
                        <Route path="/settings/profile" element={<ProtectedRoute><ProfileSettingsPage /></ProtectedRoute>} />
                        <Route path="/settings/categories" element={<ProtectedRoute><CategorySettingsPage /></ProtectedRoute>} />
                        <Route path="/settings/admin/users" element={<ProtectedRoute adminOnly><UserManagementPage /></ProtectedRoute>} />
                        <Route path="/settings/admin/global-categories" element={<ProtectedRoute adminOnly><DefaultCategoriesPage /></ProtectedRoute>} />
                        <Route path="/settings/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

                        {/* Redirect any old /my-projections or /calculator paths to the new home view if needed */}
                        <Route path="/my-projections" element={<Navigate to="/" replace />} />
                        <Route path="/calculator" element={<Navigate to="/" replace />} />
                        </Routes>
                    </main>
                </NavigationGuard>
            </AuthProvider>
        </Router>
    );
}

export default App;
