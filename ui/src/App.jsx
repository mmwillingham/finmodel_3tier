import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import NavigationGuard from './components/NavigationGuard';
import SettingsPageLayout from './components/SettingsLayout';
import { SettingsProvider } from './context/SettingsContext.jsx';

// Import all main components
import Header from './components/Header.jsx';
import LoginPage from './components/LoginPage.jsx';
import SignupPage from './components/SignupPage.jsx';
import SidebarLayout from './components/SidebarLayout';
import ResetPasswordPage from './components/ResetPasswordPage';
import EmailConfirmationPage from './components/EmailConfirmationPage';
import GoogleAuthCallback from './components/GoogleAuthCallback';

// Import new settings pages
import ApplicationSettingsPage from './pages/ApplicationSettingsPage.jsx';
import ProfileSettingsPage from './pages/ProfileSettingsPage.jsx';
import CategorySettingsPage from './pages/CategorySettingsPage.jsx';
import AccountsSettingsPage from './pages/AccountsSettingsPage.jsx';
import AutoDisbursementSettingsPage from './pages/AutoDisbursementSettingsPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import DefaultCategoriesPage from './pages/DefaultCategoriesPage.jsx';
import HelpPage from './pages/HelpPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ExportImportPage from './pages/ExportImportPage.jsx';
import ReferAFriendPage from './pages/ReferAFriendPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import AuthorizedUsersPage from './pages/AuthorizedUsersPage.jsx';
import AccountSwitcherPage from './pages/AccountSwitcherPage.jsx';

// The Main Application Structure
function App() {
    return (
        <Router>
            {/* Wrap the entire app in the Auth Provider */}
            <AuthProvider>
                <SettingsProvider>
                    <NavigationGuard>
                    <Header /> {/* Removed setIsSettingsModalOpen prop */}
                    <SettingsPageLayout>
                        <main className="container container-with-sidebar">
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
                            
                            {/* New Protected Settings Routes - all render within SidebarLayout to keep sidebar visible */}
                            <Route path="/settings/account-switcher" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/application" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/profile" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/categories" element={<Navigate to="/categories" replace />} />
                            <Route path="/settings/accounts" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/categories" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/auto-disbursements" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/admin/users" element={<ProtectedRoute adminOnly><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/admin/global-categories" element={<ProtectedRoute adminOnly><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/export-import" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/refer-a-friend" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/authorized-users" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/documents" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/help" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                            <Route path="/settings/about" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />

                            {/* Redirect any old /my-projections or /calculator paths to the new home view if needed */}
                            <Route path="/my-projections" element={<Navigate to="/" replace />} />
                            <Route path="/calculator" element={<Navigate to="/" replace />} />
                            </Routes>
                        </main>
                    </SettingsPageLayout>
                </NavigationGuard>
                </SettingsProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
