import React, { useEffect, useState } from 'react';

const fetchHeaders = async (url) => {
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  return {
    url,
    status: response.status,
    cacheControl: response.headers.get('cache-control') || 'N/A',
    age: response.headers.get('age') || 'N/A',
    via: response.headers.get('via') || 'N/A',
  };
};

const CacheTestPage = () => {
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const runTests = async () => {
    setIsLoading(true);
    setError('');
    try {
      const targets = ['/'];
      const assetScript = document.querySelector('script[src*="/assets/"]');
      if (assetScript?.getAttribute('src')) {
        targets.push(assetScript.getAttribute('src'));
      }
      const data = [];
      for (const target of targets) {
        data.push(await fetchHeaders(target));
      }
      setResults(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch cache headers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2>Cache Header Test</h2>
      <p>Checks `Cache-Control` headers for the public homepage and the main JS bundle.</p>
      <p style={{ color: '#475569', marginTop: '-6px' }}>
        If the asset URL is missing, refresh once the app is fully loaded.
      </p>
      <button type="button" onClick={runTests} disabled={isLoading} style={{ marginBottom: '16px' }}>
        {isLoading ? 'Checking...' : 'Re-run checks'}
      </button>
      {error && <div style={{ color: '#b91c1c', marginBottom: '12px' }}>{error}</div>}
      {results.map((item) => (
        <div key={item.url} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <div>
            <strong>URL:</strong>{' '}
            <a href={item.url} style={{ color: '#2563eb' }} target="_blank" rel="noreferrer">
              {item.url}
            </a>
          </div>
          <div><strong>Status:</strong> {item.status}</div>
          <div><strong>Cache-Control:</strong> {item.cacheControl}</div>
          <div><strong>Age:</strong> {item.age}</div>
          <div><strong>Via:</strong> {item.via}</div>
        </div>
      ))}
    </div>
  );
};

export default CacheTestPage;
