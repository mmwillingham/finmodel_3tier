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
    <div className="settings-page-container">
      <h2>Refer a Friend</h2>
      {message && (
        <div className={`message ${message.includes('Error') || message.includes('Please') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {stats && (
        <div style={{ 
          marginBottom: '30px', 
          padding: '20px', 
          backgroundColor: '#f0f7ff', 
          borderRadius: '8px',
          border: '1px solid #b3d9ff'
        }}>
          <h3 style={{ marginTop: 0 }}>Your Referral Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#0b57d0' }}>{stats.total_referrals}</div>
              <div style={{ color: '#666' }}>Total Referrals</div>
            </div>
            <div>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#28a745' }}>{stats.registered_referrals}</div>
              <div style={{ color: '#666' }}>Registered</div>
            </div>
            <div>
              <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#ffc107' }}>{stats.pending_referrals}</div>
              <div style={{ color: '#666' }}>Pending</div>
            </div>
          </div>
        </div>
      )}

      <div className="setting-group" style={{ marginBottom: '40px' }}>
        <h3>Submit a Referral</h3>
        <p style={{ marginBottom: '20px', color: '#666' }}>
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
          <table className="accounts-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr>
                <th>Friend's Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Registered Date</th>
                <th>Referral Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id}>
                  <td>{referral.friend_name}</td>
                  <td>{referral.friend_email}</td>
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
        )}
      </div>

      <div className="settings-page-actions">
        <button onClick={() => navigate('/')} className="cancel-button">Back</button>
      </div>
    </div>
  );
};

export default ReferAFriendPage;

