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

import ProfileSettingsPage from './pages/ProfileSettingsPage.jsx';
import ApplicationSettingsPage from './pages/ApplicationSettingsPage.jsx';
import PublicHomePage from './pages/PublicHomePage.jsx';
import FeaturesPage from './pages/FeaturesPage.jsx';
import PricingPage from './pages/PricingPage.jsx';

function App() {
    return (
        <BackendProvider>
            <Router>
                <AuthProvider>
                    <SettingsProvider>
                        <Header /> 
                        <Routes>
                            {/* --- PUBLIC STATIC ROUTES --- */}
                            <Route path="/" element={<PublicHomePage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/signup" element={<SignupPage />} />
                            <Route path="/features" element={<FeaturesPage />} />
                            <Route path="/pricing" element={<PricingPage />} />
                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                            <Route path="/confirm-email" element={<EmailConfirmationPage />} />
                            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

                            {/* --- PROTECTED APPLICATION ROUTES --- */}
                            <Route
                                path="/*"
                                element={
                                    <ProtectedRoute>
                                        <NavigationGuard>
                                            <SettingsPageLayout>
                                                <main className="container container-with-sidebar">
                                                    <Routes>
                                                        <Route path="/app" element={<SidebarLayout />} />
                                                        <Route path="/settings/profile" element={<ProfileSettingsPage />} />
                                                        <Route path="/settings/application" element={<ApplicationSettingsPage />} />
                                                        {/* Re-add other internal routes as needed */}
                                                        <Route path="*" element={<Navigate to="/app" replace />} />
                                                    </Routes>
                                                </main>
                                            </SettingsPageLayout>
                                        </NavigationGuard>
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                    </SettingsProvider>
                </AuthProvider>
                <GlobalWakeUpOverlay />
            </Router>
        </BackendProvider>
    );
}

export default App;