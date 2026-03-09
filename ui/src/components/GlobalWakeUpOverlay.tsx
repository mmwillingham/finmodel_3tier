import React from 'react';
import { useBackend } from '../context/BackendContext';
import './GlobalWakeUpOverlay.css';

const GlobalWakeUpOverlay: React.FC = () => {
  const { isReady } = useBackend();

  if (isReady) {
    return null;
  }

  return (
    <div className="wakeup-overlay">
      <div className="wakeup-content">
        <div className="rocket-container">
          <span className="rocket-icon" role="img" aria-label="rocket">
            🚀
          </span>
          <div className="launch-flame" />
        </div>
        <h2 className="wakeup-title">Firing up the engines...</h2>
        <p className="wakeup-subtitle">
          Our secure servers are waking up to prepare your financial data. This usually takes about 10
          seconds.
        </p>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" />
        </div>
      </div>
    </div>
  );
};

export default GlobalWakeUpOverlay;
