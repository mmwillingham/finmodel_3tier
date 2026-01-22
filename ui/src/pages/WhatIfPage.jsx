import React, { useState } from 'react';
import './WhatIfPage.css';
import whatIfService from '../services/what_if.service';

const exampleQuestions = [
  "What if I reinvest dividends?",
  "What if my expenses are 20% higher than expected?",
  "What if I keep working another year?",
  "What if person 1 takes social security one year later?",
  "What will my net worth be in 2040 if all my assets grow at 10% per year?",
  "What if the stock market is negative 20% in 2030?"
];

const WhatIfPage = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const response = await whatIfService.askQuestion(question);
      setAnswer(response.answer);
    } catch (err) {
      console.error('Error asking question:', err);
      setError(err.response?.data?.detail || 'Failed to get answer. Please try again.');
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
          Ask questions about your financial scenarios and get AI-powered insights based on your actual financial data.
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
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || !question.trim()}
          >
            {loading ? 'Analyzing...' : 'Ask Question'}
          </button>
        </form>

        {answer && (
          <div className="answer-section">
            <h3>Answer:</h3>
            <div className="answer-content">
              {answer.split('\n').map((line, index) => (
                <p key={index}>{line || '\u00A0'}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfPage;
