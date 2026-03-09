import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the public home heading', () => {
    render(<App />);
    const headings = screen.getAllByText(/model my retirement/i);
    expect(headings.length).toBeGreaterThan(0);
  });
});
