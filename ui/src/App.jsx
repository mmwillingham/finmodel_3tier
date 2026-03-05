import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { BackendProvider } from './context/BackendContext.jsx'; // Added this
import { SettingsProvider } from './context/SettingsContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import NavigationGuard from './components/NavigationGuard';
import SettingsPageLayout from './components/SettingsLayout';
import GlobalWakeUpOverlay from './components/GlobalWakeUpOverlay'; // Added this

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
import DefaultFoldersPage from './pages/DefaultFoldersPage.jsx';
import HelpPage from './pages/HelpPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ExportImportPage from './pages/ExportImportPage.jsx';
import ReferAFriendPage from './pages/ReferAFriendPage.jsx';
import DocumentsPage from './pages/DocumentsPage.jsx';
import AuthorizedUsersPage from './pages/AuthorizedUsersPage.jsx';
import AccountSwitcherPage from './pages/AccountSwitcherPage.jsx';
import FeaturesPage from './pages/FeaturesPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import PublicHomePage from './pages/PublicHomePage.jsx';
import CacheTestPage from './pages/CacheTestPage.jsx';
import HealthPage from './pages/HealthPage.jsx';

// The Main Application Structure
function App() {
    const isSandbox = window.location.hostname.includes('ordaxium.com');
    return (
        <BackendProvider> {/* Added Provider */}
            <Router>
                {isSandbox && (
                    <div style={{
                        backgroundColor: '#1a365d',
                        color: '#ffffff',
                        padding: '10px 20px',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: '500',
                        zIndex: 10000,
                        position: 'fixed', // Keep it fixed at the top
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '40px' // Give it a fixed height
                    }}>
                        🚀 <strong>Sandbox Mode:</strong> This website is for testing.
                        For actual data, please visit our main website at <a href="https://modelmyretirement.com" style={{ color: '#63b3ed', textDecoration: 'underline', fontWeight: 'bold' }}>modelmyretirement.com</a>.
                        <style>{`:root { --banner-height: 40px; }`}</style>
                    </div>
                )}
                <AuthProvider>
                    <SettingsProvider>
                        <NavigationGuard>
                            <Header />
                            <SettingsPageLayout>
                                <main className="container container-with-sidebar">
                                    <Routes>
                                        {/* Public Routes */}
                                        <Route path="/" element={<PublicHomePage />} />
                                        <Route path="/login" element={<LoginPage />} />
                                        <Route path="/signup" element={<SignupPage />} />
                                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                                        <Route path="/confirm-email" element={<EmailConfirmationPage />} />
                                        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
                                        <Route path="/features" element={<FeaturesPage />} />
                                        <Route path="/pricing" element={<PricingPage />} />
                                        <Route path="/cache-test" element={<CacheTestPage />} />
                                        <Route path="/health" element={<HealthPage />} />
                                        <Route path="/health/" element={<HealthPage />} />

                                        {/* Protected Routes (Require JWT) */}
                                        <Route
                                            path="/app"
                                            element={
                                                <ProtectedRoute>
                                                    <SidebarLayout />
                                                </ProtectedRoute>
                                            }
                                        />
                                        <Route path="/accounts" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/assets" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/liabilities" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/cashflow/income" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/cashflow/expense" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/automatic-transfers" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/categories" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/account-switcher" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/application" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/profile" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/tax-handling" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/categories" element={<Navigate to="/categories" replace />} />
                                        <Route path="/settings/accounts" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/auto-disbursements" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/admin/users" element={<ProtectedRoute adminOnly><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/admin/global-categories" element={<ProtectedRoute adminOnly><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/admin/default-folders" element={<ProtectedRoute adminOnly><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/export-import" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/refer-a-friend" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/authorized-users" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/documents" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/help" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />
                                        <Route path="/settings/about" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} />

                                        <Route path="/my-projections" element={<Navigate to="/app" replace />} />
                                        <Route path="/calculator" element={<Navigate to="/app" replace />} />
                                    </Routes>
                                </main>
                            </SettingsPageLayout>
                        </NavigationGuard>
                    </SettingsProvider>
                </AuthProvider>
                <GlobalWakeUpOverlay /> {/* Added Component */}
            </Router>
        </BackendProvider>
    );
}

export default App;
