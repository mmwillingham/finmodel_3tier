import React, { useState, useEffect } from 'react';
import './WhatIfPage.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import whatIfService from '../services/what_if.service';
import SettingsService from '../services/settings.service';
import { useSettingsContext } from '../context/SettingsContext';

const exampleQuestions = [
  "Compare the long term affect on my net worth between keeping or reinvesting dividends.",
  "How will my 2040 net worth be affected if inflation is 2% higher than expected?",
  "If my assets grow at 0% and my income drops to 60,000 per year in 2028, what year will my money run out?",
  "How will taking social security at age 62 vs 67 affect my 2035 net worth?",
  "Compare my net worth in 2040 if all my assets grow at 8% vs 10% per year?",
  "How will a 20% decline in year 2030 in my investment and retirement accounts affect my net worth in 2040?"
];

const descriptionSentences = [
  "Ask questions about your financial scenarios and get AI-powered insights based on your actual financial data.",
  "IMPORTANT",
  "- This is a beta feature and may not be accurate.",
  "- This feature will soon only be available for users with a paid subscription.",
  "- No Personally Identifiable Information (PII) will be shared with the AI model."
];

const WhatIfPage = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<any>(null);
  
  const { refreshSettings } = useSettingsContext();

  // Fix: Your service uses 'getSubscriptionLimits', not 'getLimits'
  const fetchLimits = async () => {
    try {
      const response = await SettingsService.getSubscriptionLimits();
      setLimits(response.data);
    } catch (err) {
      console.error('Error fetching limits:', err);
    }
  };

  useEffect(() => {
    fetchLimits();
    if (refreshSettings) {
      refreshSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      // Using your existing service pattern
      await whatIfService.askQuestion(question, (chunk: any, fullAnswer: any) => {
        setAnswer(fullAnswer);
      });
      fetchLimits();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (q: string) => {
    setQuestion(q);
  };

  return (
    <div className="what-if-page">
      <div className="what-if-container page-shell-card">
        <h1>What If Scenarios</h1>
        
        <div className="what-if-description">
          {descriptionSentences.map((s, i) => (
            <p key={i} style={{ margin: '4px 0' }}>{s}</p>
          ))}
        </div>

        <div className="examples-section">
          <h3>Example Questions:</h3>
          <div className="examples-grid">
            {exampleQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                className="example-button"
                onClick={() => handleExampleClick(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="question-form">
          <div className="form-group">
            <label htmlFor="question">Your Question:</label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., How will retiring at 62 instead of 67 affect my net worth in 2045?"
              rows={4}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="subscription-gate-card">
              <h3>Feature Locked</h3>
              <p>{error}</p>
              <button 
                type="button"
                onClick={() => window.location.href='/pricing'}
                className="btn-primary-modern"
              >
                Upgrade to Pro
              </button>
            </div>
          )}

          {limits?.is_limited && (
            <div className="limit-info-note">
              ℹ️ <strong>Free Tier:</strong> Projections capped at 5 years. Paid plans support up to 30 years.
            </div>
          )}

          <button
            type="submit"
            className="btn-primary-modern"
            disabled={loading || !question.trim()}
            style={{ marginTop: '20px' }}
          >
            {loading ? 'Analyzing...' : 'Ask Question'}
          </button>
        </form>

        {(answer || loading) && (
          <div className="answer-section">
            <h3>Answer:</h3>
            <div className="answer-content">
              {answer ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
              ) : (
                <p>Thinking...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfPage;