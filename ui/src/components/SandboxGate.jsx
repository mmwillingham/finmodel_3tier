import React, { useState } from 'react';

const SandboxGate = ({ onProceed }) => {
    const [rememberMe, setRememberMe] = useState(false);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.9)', 
            zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                background: '#1e293b', padding: '40px', borderRadius: '16px',
                maxWidth: '450px', width: '90%', textAlign: 'center',
                border: '1px solid #334155', color: '#f8fafc',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ fontSize: '40px', marginBottom: '20px' }}>🚀</div>
                <h2 style={{ marginBottom: '15px', color: '#38bdf8' }}>Sandbox Environment</h2>
                
                <p style={{ marginBottom: '10px', lineHeight: '1.6' }}>
                    You are currently on <strong>ordaxium.com</strong>.
                </p>
                
                <p style={{ marginBottom: '25px', color: '#94a3b8', fontSize: '14px' }}>
                    This is a testing site. For your actual retirement data, please visit 
                    <a href="https://modelmyretirement.com" style={{ color: '#38bdf8', marginLeft: '5px', textDecoration: 'underline' }}>
                        modelmyretirement.com
                    </a>.
                </p>

                <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    gap: '10px', marginBottom: '25px', cursor: 'pointer' 
                }} onClick={() => setRememberMe(!rememberMe)}>
                    <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        readOnly 
                        style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Don't show this again on this browser</span>
                </div>

                <button 
                    onClick={() => onProceed(rememberMe)}
                    style={{
                        backgroundColor: '#0284c7', color: 'white', border: 'none',
                        padding: '12px 30px', borderRadius: '8px', fontWeight: '600',
                        cursor: 'pointer', width: '100%'
                    }}
                >
                    I Understand, Proceed
                </button>
            </div>
        </div>
    );
};

export default SandboxGate;