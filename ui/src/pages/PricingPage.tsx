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
    <div className="settings-page-container">
      <h2 style={{ textAlign: 'center' }}>Pricing</h2>
      <p>Choose the tier that best suits your financial planning needs.</p>
      <div className="pricing-grid">
        {tiers.map((tier) => (
          <div key={tier.slug} className="pricing-card">
            <h3>{tier.label}</h3>
            <p>{tier.description}</p>
            <button
              className="submit-button"
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
