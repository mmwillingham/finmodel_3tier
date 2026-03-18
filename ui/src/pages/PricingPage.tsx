import React, { useState } from 'react';
import BillingService from '../services/billing.service';

const tiers: { label: string; description: string; slug: 'premium' | 'pro' }[] = [
  {
    label: 'Pro',
    description: 'Unlock custom charts, advanced AI models, and priority email support. Only $29/month.',
    slug: 'pro',
  },
  {
    label: 'Premium',
    description: 'All Pro features plus concierge onboarding and dedicated strategy reviews. Only $49/month.',
    slug: 'premium',
  },
];

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<'premium' | 'pro' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpgrade = async (tier: 'premium' | 'pro') => {
    setMessage(null);
    setLoadingTier(tier);
    try {
      const session = await BillingService.createCheckoutSession(tier);
      window.location.href = session.url;
    } catch (error: any) {
      setMessage(error.response?.data?.detail || error.message || 'Failed to initiate checkout.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: '#020617',
      color: '#f8fafc'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
        Pricing
      </h1>
      <p style={{ color: '#94a3b8' }}>
        Choose the tier that best suits your financial planning needs.
      </p>
      <div style={{
        display: 'flex',
        gap: '30px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: '40px'
      }}>
        {tiers.map((tier) => (
          <div key={tier.slug} style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '30px',
            width: '320px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3>{tier.label}</h3>
            <p>{tier.description}</p>
            <button
              style={{
                marginTop: 'auto',
                padding: '12px',
                borderRadius: '8px',
                background: '#0ea5e9',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              type="button"
              onClick={() => handleUpgrade(tier.slug)}
              disabled={loadingTier !== null}
            >
              {loadingTier === tier.slug ? 'Launching...' : `Upgrade to ${tier.label}`}
            </button>
          </div>
        ))}
      </div>
      {message && <p className="error-message">{message}</p>}
      <p style={{ marginTop: '2rem' }}>
        For discounts or questions, please contact <a href="mailto:support@modelmyretirement.com">support@modelmyretirement.com</a>
      </p>
    </div>
  );
}
