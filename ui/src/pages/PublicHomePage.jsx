import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './PublicHomePage.css';

const buildSampleImage = ({ title, accent }) => {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 24px Inter, system-ui, sans-serif';
  ctx.fillText(title, 32, 44);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  for (let x = 80; x <= 900; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x, 470);
    ctx.stroke();
  }
  for (let y = 90; y <= 450; y += 70) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(920, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 460);
  ctx.lineTo(920, 460);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50, 80);
  ctx.lineTo(50, 460);
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const startX = 80;
  const startY = 420;
  ctx.moveTo(startX, startY);
  for (let i = 1; i <= 10; i += 1) {
    const x = startX + i * 75;
    const y = startY - Math.pow(i, 1.25) * 12;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(600, 120, 280, 110);
  ctx.strokeStyle = accent;
  ctx.strokeRect(600, 120, 280, 110);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '500 14px Inter, system-ui, sans-serif';
  ctx.fillText('Sample projection (illustrative)', 620, 155);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.fillText('$1.45M', 620, 190);

  return canvas.toDataURL('image/png');
};

const PublicHomePage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState([]);

  const samples = useMemo(
    () => ([
      { title: 'Net Worth Projection', accent: '#38bdf8' },
      { title: 'Cash Flow Outlook', accent: '#fbbf24' },
      { title: 'Allocation Trend', accent: '#34d399' },
    ]),
    []
  );

  useEffect(() => {
    if (currentUser) {
      navigate('/app', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const urls = samples.map((sample) => buildSampleImage(sample));
    setImages(urls);
  }, [samples]);

  return (
    <div className="public-home">
      <section className="public-hero">
        <div>
          <p className="public-pill">Sample projections</p>
          <h1>Model My Retirement</h1>
          <p className="public-subtitle">
            Explore static, sample projections instantly. No login required.
          </p>
          <div className="public-actions">
            {currentUser ? (
              <button type="button" onClick={() => navigate('/app')} className="primary-btn">
                Go to your dashboard
              </button>
            ) : (
              <>
                <Link to="/signup" className="primary-btn">Get started</Link>
                <Link to="/login" className="secondary-btn">Log in</Link>
              </>
            )}
          </div>
        </div>
        <div className="public-hero-card">
          <div className="public-hero-meta">
            <span>Static preview</span>
            <span>Cached-ready</span>
          </div>
          <img
            src={images[0]}
            alt="Sample net worth projection chart"
            className="public-hero-image"
          />
        </div>
      </section>

      <section className="public-gallery">
        {samples.map((sample, index) => (
          <div key={sample.title} className="public-card">
            <div className="public-card-header">
              <h3>{sample.title}</h3>
              <span className="public-card-tag">Sample</span>
            </div>
            <img
              src={images[index]}
              alt={`Sample projection for ${sample.title}`}
              className="public-card-image"
            />
          </div>
        ))}
      </section>
    </div>
  );
};

export default PublicHomePage;
