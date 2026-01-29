import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.service';

const EmailMigrationForm = () => {
    const { currentUser } = useAuth();
    const [newEmail, setNewEmail] = useState('');
    const [status, setStatus] = useState({ type: '', msg: '' });

    // Only show if the current username is not an email
    const needsMigration = currentUser && !currentUser.email.includes('@');

    const handleMigration = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/users/migrate-to-email', { email: newEmail });
            setStatus({ type: 'success', msg: response.data.message });
        } catch (err) {
            setStatus({ type: 'error', msg: err.response?.data?.detail || 'Migration failed' });
        }
    };

    if (!needsMigration) return null;

    return (
        <div className="p-4 bg-amber-900/20 border border-amber-500 rounded-lg my-4">
            <h3 className="text-amber-500 font-bold">Secure Your Account</h3>
            <p className="text-sm text-slate-300 mb-4">
                You are using a legacy username. Please update to an email address to enable MFA.
            </p>
            <form onSubmit={handleMigration} className="flex flex-col gap-2">
                <input 
                    type="email" 
                    placeholder="new-username@example.com"
                    className="p-2 bg-slate-800 rounded border border-slate-700 text-white"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                />
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white py-2 rounded">
                    Verify and Update
                </button>
            </form>
            {status.msg && (
                <p className={`mt-2 text-sm ${status.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    {status.msg}
                </p>
            )}
        </div>
    );
};

export default EmailMigrationForm;