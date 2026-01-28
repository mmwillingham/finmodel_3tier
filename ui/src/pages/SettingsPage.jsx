import React, { useState } from 'react';
import ProfileSettingsPage from './ProfileSettingsPage'; // The file we just built
import './SettingsPages.css';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const navItems = [
    { id: 'profile', label: 'User Profile', icon: '👤' },
    { id: 'security', label: 'Security & MFA', icon: '🔒' },
    { id: 'billing', label: 'Billing & Plans', icon: '💳' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettingsPage />;
      case 'security':
        return <div className="placeholder-view">Security Settings Coming Soon</div>;
      default:
        return <ProfileSettingsPage />;
    }
  };

  return (
    <div className="settings-layout">
      {/* Settings Sidebar */}
      <aside className="settings-sidebar">
        <div className="sidebar-header">
          <h2>Settings</h2>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="settings-content-wrapper">
        {renderContent()}
      </main>
    </div>
  );
};

export default SettingsPage;