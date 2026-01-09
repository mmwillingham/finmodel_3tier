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
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState(null);
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
    } catch (error) {
      console.error('Failed to load referrals', error);
      setReferrals([]);
      setStats({ total_referrals: 0, registered_referrals: 0, pending_referrals: 0 });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e) => {
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
    } catch (error) {
      console.error('Failed to create referral', error);
      const errorMessage = error.response?.data?.detail || 'Error submitting referral. Please try again.';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page-container refer-a-friend-page">
      <h2>Refer a Friend</h2>
      {message && (
        <div className={`message ${message.includes('Error') || message.includes('Please') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {stats && (
        <div className="referral-stats-box">
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

      <div className="setting-group" style={{ marginBottom: '30px' }}>
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
              onChange={(e) => setFriendName(e.target.value)}
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
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="Enter friend's email address"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="save-button"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Referral'}
          </button>
        </form>
      </div>

      <div className="setting-group">
        <h3>My Referrals</h3>
        {loadingData ? (
          <div className="loading-message">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <p>You haven't referred anyone yet. Submit a referral above to get started!</p>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="accounts-table referrals-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9em', minWidth: '800px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Friend's Name</th>
                <th style={{ minWidth: '200px' }}>Email</th>
                <th style={{ minWidth: '120px' }}>Status</th>
                <th style={{ minWidth: '140px' }}>Registered Date</th>
                <th style={{ minWidth: '140px' }}>Referral Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id}>
                  <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{referral.friend_name}</td>
                  <td style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{referral.friend_email}</td>
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
        )}
      </div>

      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Back</button>
      </div>
    </div>
  );
};

export default ReferAFriendPage;

