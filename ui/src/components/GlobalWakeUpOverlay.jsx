import React from 'react';
import { useBackend } from '../context/BackendContext';
import './GlobalWakeUpOverlay.css'; // We will create this next

const GlobalWakeUpOverlay = () => {
  const { isReady, isWaking } = useBackend();

  // If the backend is ready, or if it hasn't even started "waking" yet, show nothing.
  if (isReady || !isWaking) return null;

  return (
    <div className="wakeup-overlay">
      <div className="wakeup-content">
        <div className="rocket-container">
          <span className="rocket-icon" role="img" aria-label="rocket">🚀</span>
          <div className="launch-flame"></div>
        </div>
        <h2 className="wakeup-title">Firing up the engines...</h2>
        <p className="wakeup-subtitle">
          Our secure servers are waking up to prepare your financial data. 
          This usually takes about 10 seconds.
        </p>
        <div className="progress-bar-container">
          <div className="progress-bar-fill"></div>
        </div>
      </div>
    </div>
  );
};

export default GlobalWakeUpOverlay;
