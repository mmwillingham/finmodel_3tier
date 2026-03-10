import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WhatIfPage from './WhatIfPage';
import whatIfService from '../services/what_if.service';
import SettingsService from '../services/settings.service';

vi.mock('../services/what_if.service', () => ({
  default: {
    askQuestion: vi.fn(),
  },
}));

vi.mock('../services/settings.service', () => ({
  default: {
    getSubscriptionLimits: vi.fn(),
  },
}));

describe('WhatIfPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(SettingsService.getSubscriptionLimits).mockResolvedValue({
      data: {
        is_limited: false,
      },
    } as any);
  });

  it('renders markdown formatting in the answer section', async () => {
    vi.mocked(whatIfService.askQuestion).mockImplementation(async (_question, onChunk) => {
      const markdownAnswer = '### Recommendation\n\nUse **reinvested dividends** for faster growth.';
      onChunk?.(markdownAnswer, markdownAnswer);
      return { answer: markdownAnswer };
    });

    render(<WhatIfPage />);

    await userEvent.type(
      screen.getByLabelText(/your question/i),
      'What happens if I reinvest dividends?'
    );
    await userEvent.click(screen.getByRole('button', { name: /ask question/i }));

    expect(await screen.findByRole('heading', { name: 'Recommendation' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('reinvested dividends', { selector: 'strong' })).toBeInTheDocument();
    });
  });
});
