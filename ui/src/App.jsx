import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { BackendProvider } from './context/BackendContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import NavigationGuard from './components/NavigationGuard';
import SettingsPageLayout from './components/SettingsLayout';
import GlobalWakeUpOverlay from './components/GlobalWakeUpOverlay';

import Header from './components/Header.jsx';
import LoginPage from './components/LoginPage.jsx';
import SignupPage from './components/SignupPage.jsx';
import SidebarLayout from './components/SidebarLayout';
import ResetPasswordPage from './components/ResetPasswordPage';
import EmailConfirmationPage from './components/EmailConfirmationPage';
import GoogleAuthCallback from './components/GoogleAuthCallback';

import ApplicationSettingsPage from './pages/ApplicationSettingsPage.jsx';
import ProfileSettingsPage from './pages/ProfileSettingsPage.jsx';
import CategorySettingsPage from './pages/CategorySettingsPage.jsx';
import AccountsSettingsPage from './pages/AccountsSettingsPage.jsx';
import AutoDisbursementSettingsPage from './pages/AutoDisbursementSettingsPage.jsx';
import UserManagementPage from './pages/UserManagementPage.jsx';
import DefaultCategoriesPage from './pages/DefaultCategoriesPage.jsx';

// Example Static Landing Page

const LandingPage = () => (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-6xl font-bold text-white mb-6">Financial Projector</h1>
        <p className="text-xl text-slate-400 mb-10 max-w-lg">
            A secure way to forecast your financial future. Legacy users: please log in to update your account.
        </p>
        <div className="flex gap-6">
            <a href="/login" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Login</a>
            <a href="/signup" className="px-8 py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition border border-slate-700">Sign Up</a>
        </div>
    </div>
);

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    {/* --- PUBLIC ROUTES (No Login Required) --- */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/confirm-email" element={<EmailConfirmationPage />} />
                    <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

                    {/* --- PROTECTED ROUTES (Requires Login) --- */}
                    <Route
                        path="/*"
                        element={
                            <ProtectedRoute>
                                <BackendProvider>
                                    <SettingsProvider>
                                        <NavigationGuard>
                                            <SettingsPageLayout>
                                                <Header />
                                                <main className="flex-grow">
                                                    <Routes>
                                                        <Route path="/app" element={<SidebarLayout />} />
                                                        <Route path="/settings/application" element={<ApplicationSettingsPage />} />
                                                        <Route path="/settings/profile" element={<ProfileSettingsPage />} />
                                                        <Route path="/settings/categories" element={<CategorySettingsPage />} />
                                                        <Route path="/settings/accounts" element={<AccountsSettingsPage />} />
                                                        <Route path="/settings/auto-disbursements" element={<AutoDisbursementSettingsPage />} />
                                                        <Route path="/settings/user-management" element={<ProtectedRoute adminOnly><UserManagementPage /></ProtectedRoute>} />
                                                        <Route path="/settings/default-categories" element={<ProtectedRoute adminOnly><DefaultCategoriesPage /></ProtectedRoute>} />
                                                        
                                                        {/* Default path inside the app */}
                                                        <Route path="/" element={<Navigate to="/app" replace />} />
                                                        <Route path="*" element={<Navigate to="/app" replace />} />
                                                    </Routes>
                                                </main>
                                            </SettingsPageLayout>
                                        </NavigationGuard>
                                    </SettingsProvider>
                                </BackendProvider>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;