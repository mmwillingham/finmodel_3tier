import React from 'react';

const SandboxWatermark = () => {
  const isSandbox = window.location.hostname.includes('ordaxium.com') || 
                    window.location.hostname.includes('localhost');

  if (!isSandbox) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      padding: '5px 12px',
      backgroundColor: 'rgba(30, 41, 59, 0.7)', // Slate-800 with transparency
      color: '#38bdf8', // Sky blue
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 'bold',
      letterSpacing: '0.05em',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      zIndex: 9000, // Below modals, above content
      pointerEvents: 'none', // Won't block clicks to underlying buttons
      userSelect: 'none',
      backdropFilter: 'blur(4px)'
    }}>
      SANDBOX MODE
    </div>
  );
};

export default SandboxWatermark;