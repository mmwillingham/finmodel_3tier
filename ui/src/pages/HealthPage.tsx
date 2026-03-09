import React, { useState, useEffect } from 'react';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/?$/, '');

/**
 * Public /health page. The actual health endpoint lives on the API server;
 * this page fetches it and displays the result so /health on the frontend
 * has a defined route and shows API status.
 */
function HealthPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not reach API');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p>Checking API health…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>API health check</h2>
        <p style={{ color: '#c00' }}>API not reachable: {error}</p>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          Backend URL: <code>{API_URL}/health</code>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>API health</h2>
      <p><strong>Status:</strong> {data?.status ?? '—'}</p>
      {data?.message && <p>{data.message}</p>}
      {data?.instance_id != null && <p><strong>Instance:</strong> <code>{data.instance_id}</code></p>}
      {data?.uptime_seconds != null && <p><strong>Uptime:</strong> {data.uptime_seconds}s</p>}
      <p style={{ fontSize: '0.9em', color: '#666' }}>
        Backend: <code>{API_URL}/health</code>
      </p>
    </div>
  );
}

export default HealthPage;
