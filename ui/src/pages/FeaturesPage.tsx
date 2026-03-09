import React from 'react';
import { featureDetails } from '../utils/featureTourData';
import './FeaturesPage.css';

export default function FeaturesPage() {
  return (
    <div className="settings-page-container features-page">
      <h2>Features</h2>
      <p>
        Explore the core areas of Model My Retirement. Each feature works together
        to help you model, analyze, and manage your retirement plan.
      </p>
      <div className="features-list">
        {featureDetails.map((feature: any) => (
          <div className="feature-card" key={feature.id}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
