import React, { useState, useEffect } from 'react';
import ContactService from '../services/contact.service';
import './ContactFormModal.css';

const ContactFormModal = ({ isOpen, onClose, contactType, label }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await ContactService.sendContactMessage({
        contact_type: contactType,
        name,
        email,
        subject: subject.trim() || null,
        message,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-modal-overlay">
      <div className="contact-modal-content">
        <div className="contact-modal-header">
          <h3>{label}</h3>
          <button className="contact-modal-close" type="button" onClick={onClose}>×</button>
        </div>
        <form className="contact-modal-body" onSubmit={handleSubmit}>
          {error && <div className="contact-modal-error">{error}</div>}
          <label htmlFor="contact-name">Name</label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="contact-subject">Subject</label>
          <input
            id="contact-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`${label} - Model My Retirement`}
          />

          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />

          <div className="contact-modal-actions">
            <button type="button" className="contact-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="contact-modal-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactFormModal;
