import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettingsBackButton } from '../hooks/useSettingsBackButton';
import ReferralService from '../services/referral.service';
import './SettingsPages.css';

const ReferAFriendPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  useSettingsBackButton();
  
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    setLoadingData(true);
    try {
      const [referralsRes, statsRes] = await Promise.all([
        ReferralService.getMyReferrals(),
        ReferralService.getReferralStats()
      ]);
      setReferrals(referralsRes || []);
      setStats(statsRes || { total_referrals: 0, registered_referrals: 0, pending_referrals: 0 });
    } catch (error: any) {
      setReferrals([]);
      setStats({ total_referrals: 0, registered_referrals: 0, pending_referrals: 0 });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!friendName.trim() || !friendEmail.trim()) {
      setMessage('Please enter both name and email.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(friendEmail)) {
      setMessage('Please enter a valid email address.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      await ReferralService.createReferral(friendName.trim(), friendEmail.trim());
      setMessage('Referral submitted successfully! Your friend will be tracked when they register.');
      setFriendName('');
      setFriendEmail('');
      loadReferrals(); // Reload the list
      setTimeout(() => setMessage(''), 5000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Error submitting referral. Please try again.';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page-container refer-a-friend-page" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      <h2>Refer a Friend</h2>
      {message && (
        <div className={`message ${message.includes('Error') || message.includes('Please') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* Top Section: Stats and Form Side by Side */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px', alignItems: 'start' }}>
          {stats && (
            <div className="referral-stats-box" style={{ alignSelf: 'start' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Your Referral Statistics</h3>
              <div className="referral-stats-grid">
                <div className="stat-item">
                  <div className="stat-number stat-blue">{stats.total_referrals}</div>
                  <div className="stat-label">Total Referrals</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number stat-green">{stats.registered_referrals}</div>
                  <div className="stat-label">Registered</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number stat-yellow">{stats.pending_referrals}</div>
                  <div className="stat-label">Pending</div>
                </div>
              </div>
            </div>
          )}

          <div className="setting-group" style={{ marginLeft: stats ? '0' : 'auto', marginRight: stats ? '0' : 'auto', maxWidth: '500px' }}>
            <h3>Submit a Referral</h3>
            <p className="referral-description">
              Enter your friend's information below. When they register, we'll track that they were referred by you.
              You can use this information to provide credits or discounts for successful referrals.
            </p>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group-horizontal" style={{ marginBottom: '20px' }}>
                <label htmlFor="friend-name">Friend's Name *</label>
                <input
                  id="friend-name"
                  type="text"
                  value={friendName}
                  onChange={(e: any) => setFriendName(e.target.value)}
                  placeholder="Enter friend's name"
                  required
                />
              </div>
              
              <div className="form-group-horizontal" style={{ marginBottom: '20px' }}>
                <label htmlFor="friend-email">Friend's Email *</label>
                <input
                  id="friend-email"
                  type="email"
                  value={friendEmail}
                  onChange={(e: any) => setFriendEmail(e.target.value)}
                  placeholder="Enter friend's email address"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="btn-primary-modern"
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Referral'}
              </button>
            </form>
          </div>
        </div>

        {/* Full Width: Referrals Table Below */}
        <div style={{ marginTop: '20px', width: '100%', display: 'block' }}>
          <h3 style={{ marginBottom: '15px', marginLeft: '0', paddingLeft: '0', textAlign: 'left' }}>My Referrals</h3>
          {loadingData ? (
            <div className="loading-message">Loading referrals...</div>
          ) : referrals.length === 0 ? (
            <p>You haven't referred anyone yet. Submit a referral above to get started!</p>
          ) : (
            <div style={{ width: '100%', marginTop: '0', marginLeft: '0', paddingLeft: '0', display: 'block' }}>
              <div className="table-scroll">
              <table className="accounts-table referrals-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', tableLayout: 'fixed', marginLeft: '0' }}>
                <thead>
                  <tr>
                    <th style={{ width: '18%' }}>Friend's Name</th>
                    <th style={{ width: '28%' }}>Email</th>
                    <th style={{ width: '14%' }}>Status</th>
                    <th style={{ width: '20%' }}>Registered Date</th>
                    <th style={{ width: '20%' }}>Referral Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral: any) => (
                    <tr key={referral.id}>
                      <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{referral.friend_name}</td>
                      <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={referral.friend_email}>{referral.friend_email}</td>
                      <td>
                        {referral.registered_user_id ? (
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>Registered ✓</span>
                        ) : (
                          <span style={{ color: '#ffc107' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {referral.registered_at 
                          ? new Date(referral.registered_at).toLocaleDateString()
                          : '-'
                        }
                      </td>
                      <td>{new Date(referral.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="settings-page-actions" style={{ marginTop: '20px' }}>
        <button onClick={() => navigate('/app')} className="cancel-button">Back</button>
      </div>
    </div>
  );
};

export default ReferAFriendPage;

