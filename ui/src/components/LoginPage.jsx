import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import AuthService from '../services/auth.service';
import { useAuth } from '../context/AuthContext';
import ForgotPasswordModal from './ForgotPasswordModal';
import '../styles/AuthForms.css'; 

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaToken, setMfaToken] = useState('');
    const [mfaMethods, setMfaMethods] = useState([]);
    const [mfaMethod, setMfaMethod] = useState('');
    const [otp, setOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpInfo, setOtpInfo] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [rememberDevice, setRememberDevice] = useState(true);

    const navigate = useNavigate();
    const location = useLocation();
    const { login, currentUser, logout } = useAuth();

    useEffect(() => {
        if (location.state && location.state.error) {
            setError(location.state.error);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (!email || !password) {
            setError("Please enter both user name and password.");
            setLoading(false);
            return;
        }

        try {
            const loginResponse = await AuthService.login(email, password);

            if (loginResponse?.mfa_required) {
                setMfaRequired(true);
                setMfaToken(loginResponse.mfa_token);
                setMfaMethods(loginResponse.mfa_methods || []);
                setMfaMethod((loginResponse.mfa_methods || [])[0] || 'email');
                setLoading(false);
                return;
            }

            await login();
            const userData = loginResponse.user || currentUser;

            if (userData && userData.email && !userData.is_confirmed) {
                logout();
                setError("Error: Your email address has not been confirmed.");
                setLoading(false);
                return;
            }
            
            if (loginResponse.must_change_password === true || (userData && userData.must_change_password === true)) {
                navigate('/app', { state: { mustChangePassword: true } });
                return;
            }
            
            navigate('/app');
        } catch (err) {
            const errorMessage = err.response?.data?.detail || err.message || "Network Error";
            setError(`Error: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container card-modern">
                <div className="auth-header">
                    <h2>Welcome Back</h2>
                    <p>Log in to manage your retirement plan</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="message-banner error">
                            {error}
                        </div>
                    )}

                    <div className="form-field">
                        <label htmlFor="email">User name or Email</label>
                        <input
                            type="text"
                            id="email"
                            className="input-modern"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Enter your user name"
                        />
                    </div>

                    <div className="form-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label htmlFor="password">Password</label>
                            <button 
                                type="button" 
                                onClick={() => setIsForgotPasswordModalOpen(true)} 
                                className="auth-link" 
                                style={{ fontSize: '0.85em', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                                Forgot?
                            </button>
                        </div>
                        <input
                            type="password"
                            id="password"
                            className="input-modern"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" disabled={loading} className="auth-submit-btn">
                        {loading ? 'Logging In...' : 'Log In'}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e2e8f0' }} />
                        <span style={{ padding: '0 10px', color: '#94a3b8', fontSize: '0.8em' }}>OR</span>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e2e8f0' }} />
                    </div>

                    <button 
                        type="button" 
                        onClick={() => window.location.href = `${(process.env.REACT_APP_API_URL || "http://localhost:8000").replace(/\/?$/, '/')}auth/google`}
                        disabled={loading} 
                        className="google-signin-button"
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" />
                        Sign in with Google
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Don't have an account?</span>
                    <Link to="/signup" className="auth-link">Sign Up</Link>
                </div>
            </div>

            <ForgotPasswordModal
                isOpen={isForgotPasswordModalOpen}
                onClose={() => setIsForgotPasswordModalOpen(false)}
            />

            {/* MFA Modal Implementation */}
            {mfaRequired && (
                <div className="auth-modal-overlay" onClick={() => setMfaRequired(false)}>
                    <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="auth-header" style={{ marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Verify Identity</h3>
                            <p style={{ fontSize: '0.85em' }}>Enter the code sent to your {mfaMethod}</p>
                        </div>

                        {otpError && <div className="message-banner error" style={{ marginBottom: '15px' }}>{otpError}</div>}
                        {otpInfo && <div className="message-banner success" style={{ marginBottom: '15px' }}>{otpInfo}</div>}

                        <div className="form-field">
                            <label htmlFor="mfa-method">Delivery Method</label>
                            <select
                                id="mfa-method"
                                className="input-modern"
                                value={mfaMethod}
                                onChange={(e) => setMfaMethod(e.target.value)}
                                disabled={otpLoading}
                            >
                                {mfaMethods.includes('email') && <option value="email">Email</option>}
                                {mfaMethods.includes('sms') && <option value="sms">SMS (Coming Soon)</option>}
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="mfa-code">Verification Code</label>
                            <input
                                id="mfa-code"
                                type="text"
                                className="input-modern"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="6-digit code"
                                disabled={otpLoading}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                            <input
                                id="mfa-remember"
                                type="checkbox"
                                checked={rememberDevice}
                                onChange={(e) => setRememberDevice(e.target.checked)}
                                disabled={otpLoading}
                            />
                            <label htmlFor="mfa-remember" style={{ fontSize: '0.85em', color: '#64748b' }}>
                                Trust this device for 90 days
                            </label>
                        </div>

                        <div className="auth-modal-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                disabled={otpLoading}
                                onClick={async () => {
                                    setOtpLoading(true);
                                    try {
                                        const response = await AuthService.requestMfaOtp(mfaToken, mfaMethod);
                                        setOtpInfo(`Code sent to ${response.destination || `your ${mfaMethod}`}.`);
                                    } catch (err) { setOtpError('Failed to send code.'); }
                                    finally { setOtpLoading(false); }
                                }}
                            >
                                Send Code
                            </button>
                            <button
                                type="button"
                                className="auth-submit-btn"
                                style={{ padding: '8px 16px' }}
                                disabled={otpLoading || !otp}
                                onClick={async () => {
                                    setOtpLoading(true);
                                    try {
                                        const verifyResponse = await AuthService.verifyMfaOtp(mfaToken, mfaMethod, otp, rememberDevice);
                                        await login();
                                        const userData = verifyResponse.user || currentUser;
                                        navigate(verifyResponse.must_change_password || userData?.must_change_password ? '/app' : '/app', 
                                            { state: { mustChangePassword: !!(verifyResponse.must_change_password || userData?.must_change_password) } });
                                        setMfaRequired(false);
                                    } catch (err) { setOtpError('Invalid code.'); }
                                    finally { setOtpLoading(false); }
                                }}
                            >
                                Verify
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;