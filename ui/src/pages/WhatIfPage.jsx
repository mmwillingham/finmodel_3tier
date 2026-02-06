import React, { useState, useEffect } from 'react';
import './WhatIfPage.css';
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
  const [error, setError] = useState(null);
  const [limits, setLimits] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadLimits = async () => {
      try {
        const response = await SettingsService.getSubscriptionLimits();
        if (isMounted) {
          setLimits(response.data);
        }
      } catch (err) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      await whatIfService.askQuestion(question, (chunk, fullAnswer) => {
        // Update answer incrementally as chunks arrive
        setAnswer(fullAnswer);
      });
    } catch (err) {
      const message = err.message || 'Failed to get answer. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuestion) => {
    setQuestion(exampleQuestion);
    setAnswer('');
    setError(null);
  };

  return (
    <div className="what-if-page">
      <div className="what-if-container">
        <h1>What If?</h1>
        <p className="what-if-description">
          {descriptionSentences.map((sentence, index) => (
            <React.Fragment key={sentence}>
              {sentence}
              {index < descriptionSentences.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>

        <div className="examples-section">
          <h3>Example Questions:</h3>
          <div className="examples-grid">
            {exampleQuestions.map((example, index) => (
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
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a 'What If?' question about your finances..."
              rows={4}
              disabled={loading}
              className="question-input"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
              {error.toLowerCase().includes('free plan') && (
                <div style={{ marginTop: '8px' }}>
                  Upgrade on the <a href="/pricing">Pricing</a> page to unlock more requests.
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
                answer.split('\n').map((line, index) => (
                  <p key={index}>{line || '\u00A0'}</p>
                ))
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
