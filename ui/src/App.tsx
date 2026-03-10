import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BackendProvider } from './context/BackendContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import NavigationGuard from './components/NavigationGuard';
import SettingsPageLayout from './components/SettingsLayout';
import GlobalWakeUpOverlay from './components/GlobalWakeUpOverlay';

// Import all main components
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import SidebarLayout from './components/SidebarLayout';
import ResetPasswordPage from './components/ResetPasswordPage';
import EmailConfirmationPage from './components/EmailConfirmationPage';
import GoogleAuthCallback from './components/GoogleAuthCallback';
import SandboxGate from './components/SandboxGate';
import SandboxWatermark from './components/SandboxWatermark';

// Import new settings pages
import ApplicationSettingsPage from './pages/ApplicationSettingsPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import CategorySettingsPage from './pages/CategorySettingsPage';
import AccountsSettingsPage from './pages/AccountsSettingsPage';
import AutoDisbursementSettingsPage from './pages/AutoDisbursementSettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import DefaultCategoriesPage from './pages/DefaultCategoriesPage';
import DefaultFoldersPage from './pages/DefaultFoldersPage';
import HelpPage from './pages/HelpPage';
import AboutPage from './pages/AboutPage';
import ExportImportPage from './pages/ExportImportPage';
import ReferAFriendPage from './pages/ReferAFriendPage';
import AuthorizedUsersPage from './pages/AuthorizedUsersPage';
import AccountSwitcherPage from './pages/AccountSwitcherPage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import PublicHomePage from './pages/PublicHomePage';
import CacheTestPage from './pages/CacheTestPage';
import HealthPage from './pages/HealthPage';

// The Main Application Structure
const App: React.FC = () => {
  const [showSandboxGate, setShowSandboxGate] = useState(false);

  useEffect(() => {
    const isSandboxDomain =
      window.location.hostname.includes('ordaxium.com') ||
      window.location.hostname.includes('localhost');
    const hasAcknowledged = localStorage.getItem('sandbox_acknowledged');

    if (isSandboxDomain && !hasAcknowledged) {
      setShowSandboxGate(true);
    }
  }, []);

  const handleProceed = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('sandbox_acknowledged', 'true');
    }
    setShowSandboxGate(false);
  };

  return (
    <BackendProvider>
      <Router>
        {showSandboxGate && <SandboxGate onProceed={handleProceed} />}
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
        <GlobalWakeUpOverlay />
        <SandboxWatermark />
      </Router>
    </BackendProvider>
  );
};

export default App;
