import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import all main components
import Header from './components/Header'; 
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import SidebarLayout from './components/SidebarLayout';
import ResetPasswordPage from './components/ResetPasswordPage';
import EmailConfirmationPage from './components/EmailConfirmationPage';

// Import Modals and their state management
import SettingsModal, { useCategoryModalStates } from './components/SettingsModal';
// import CategoryEditorModal from './components/CategoryEditorModal'; // REMOVED: Now managed internally by SettingsModal
import ChangePasswordModal from './components/ChangePasswordModal';

// The Main Application Structure
function App() {
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const {
      isAssetModalOpen, setIsAssetModalOpen,
      isLiabilityModalOpen, setIsLiabilityModalOpen,
      isIncomeModalOpen, setIsIncomeModalOpen,
      isExpenseModalOpen, setIsExpenseModalOpen,
      isChangePasswordModalOpen, setIsChangePasswordModalOpen,
    } = useCategoryModalStates();


    return (
        <Router>
            {/* Wrap the entire app in the Auth Provider */}
            <AuthProvider>
                <Header setIsSettingsModalOpen={setIsSettingsModalOpen} />
                <main className="container">
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/confirm-email" element={<EmailConfirmationPage />} />

                        {/* Protected Routes (Require JWT) */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <SidebarLayout />
                                </ProtectedRoute>
                            }
                        />
                        {/* Removed /my-projections route, as its functionality is replaced within SidebarLayout */}
                        {/* <Route path="/my-projections" element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>} /> */}
                        
                        {/* Redirect any old /my-projections or /calculator paths to the new home view if needed */}
                        <Route path="/my-projections" element={<Navigate to="/" replace />} />
                        <Route path="/calculator" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>

                {/* Settings Modal - Rendered at App level to overlay everything */}
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    onSettingsSaved={() => { /* Optionally refresh settings in other components */ }}
                    // Props to control nested modals
                    isAssetModalOpen={isAssetModalOpen}
                    setIsAssetModalOpen={setIsAssetModalOpen}
                    isLiabilityModalOpen={isLiabilityModalOpen}
                    setIsLiabilityModalOpen={setIsLiabilityModalOpen}
                    isIncomeModalOpen={isIncomeModalOpen}
                    setIsIncomeModalOpen={setIsIncomeModalOpen}
                    isExpenseModalOpen={isExpenseModalOpen}
                    setIsExpenseModalOpen={setIsExpenseModalOpen}
                    isChangePasswordModalOpen={isChangePasswordModalOpen}
                    setIsChangePasswordModalOpen={setIsChangePasswordModalOpen}
                />

                {/* Category Editor Modals are now managed internally by SettingsModal, not App.js */}


                {/* Change Password Modal - Rendered at App level to overlay everything */}
                <ChangePasswordModal
                    isOpen={isChangePasswordModalOpen}
                    onClose={() => setIsChangePasswordModalOpen(false)}
                />

            </AuthProvider>
        </Router>
    );
}

export default App;
