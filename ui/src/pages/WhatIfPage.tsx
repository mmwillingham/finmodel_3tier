import React, { useState, useEffect } from 'react';
import './WhatIfPage.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import whatIfService from '../services/what_if.service';
import SettingsService from '../services/settings.service';

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
  const [error, setError] = useState<any>(null);
  const [limits, setLimits] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const loadLimits = async () => {
      try {
        const response = await SettingsService.getSubscriptionLimits();
        if (isMounted) {
          setLimits(response.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setLimits(null);
        }
      }
    };
    loadLimits();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      await whatIfService.askQuestion(question, (chunk: any, fullAnswer: any) => {
        // Update answer incrementally as chunks arrive
        setAnswer(fullAnswer);
      });
    } catch (err: any) {
      const message = err.message || 'Failed to get answer. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuestion: any) => {
    setQuestion(exampleQuestion);
    setAnswer('');
    setError(null);
  };

  return (
    <div className="what-if-page">
      <div className="what-if-container">
        <h1>What If?</h1>
        <p className="what-if-description">
          {descriptionSentences.map((sentence: any, index: any) => (
            <React.Fragment key={sentence}>
              {sentence}
              {index < descriptionSentences.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>

        <div className="examples-section">
          <h3>Example Questions:</h3>
          <div className="examples-grid">
            {exampleQuestions.map((example: any, index: any) => (
              <button
                key={index}
                className="example-button"
                onClick={() => handleExampleClick(example)}
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="what-if-form">
          <div className="form-group">
            <label htmlFor="question">Your Question:</label>
            <textarea
              id="question"
              value={question}
              onChange={(e: any) => setQuestion(e.target.value)}
              placeholder="Ask a 'What If?' question about your finances..."
              rows={4}
              disabled={loading}
              className="question-input"
            />
          </div>

          {error && (
            <div className="error-message-container" style={{ marginTop: '20px' }}>
              {/* This check matches the 'detail' string in your updated what_if.py */}
              {error.includes("Upgrade to Pro") || error.toLowerCase().includes("free plan") ? (
                <div style={{ 
                  backgroundColor: '#fff3cd', 
                  border: '1px solid #ffeeba', 
                  borderRadius: '12px', 
                  padding: '30px', 
                  textAlign: 'center',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ color: '#856404', margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 'bold' }}>
                    Unlock AI Projections
                  </h3>
                  <p style={{ color: '#856404', margin: '0 0 20px 0', fontSize: '1rem', lineHeight: '1.5' }}>
                    Paid subscribers can simulate net worth changes, inflation spikes, and retirement timing.
                  </p>
                  <a 
                    href="/pricing" 
                    className="btn-primary-modern"
                    style={{ 
                      display: 'inline-block', 
                      textDecoration: 'none',
                      padding: '12px 24px',
                      backgroundColor: '#007bff',
                      color: '#ffffff', // High contrast white text for the button
                      borderRadius: '6px',
                      fontWeight: '600'
                    }}
                  >
                    View Pricing & Plans
                  </a>
                </div>
              ) : (
                <div style={{ color: '#ff4d4d', padding: '10px', textAlign: 'center' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {limits?.is_limited && limits.max_whatif_monthly != null && (
            <div style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
              Free plan: up to {limits.max_whatif_monthly} What If requests per month.
            </div>
          )}

          <button
            type="submit"
            className="btn-primary-modern"
            disabled={loading || !question.trim()}
          >
            {loading ? 'Analyzing...' : 'Ask Question'}
          </button>
        </form>

        {(answer || loading) && (
          <div className="answer-section">
            <h3>Answer:</h3>
            <div className="answer-content">
              {answer ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node: _node, ...props }) => (
                      <a {...props} target="_blank" rel="noreferrer" />
                    ),
                  }}
                >
                  {answer}
                </ReactMarkdown>
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
