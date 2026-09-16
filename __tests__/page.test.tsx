/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../app/page';
import { RESUME_STORAGE_KEY } from '@/lib/constants';

// Mock hooks. Mutable so a test can change the key while a check is in flight.
const mockApiKeyState = { anthropicKey: 'test-key', dropboxToken: 'test-token' };

jest.mock('@/hooks/useApiKey', () => ({
  useApiKey: () => ({
    anthropicKey: mockApiKeyState.anthropicKey,
    dropboxToken: mockApiKeyState.dropboxToken,
    setAnthropicKey: jest.fn(),
    setDropboxToken: jest.fn(),
  }),
}));

const mockHandleGenerate = jest.fn();
const mockHandleRefine = jest.fn();
const mockHandleRevert = jest.fn();
const mockHandleRefreshRecommendations = jest.fn();
const mockSetJD = jest.fn();
const mockSetCompany = jest.fn();
const mockHandleResumeChange = jest.fn();
const mockSetSelectedModel = jest.fn();

jest.mock('@/hooks/useGenerate', () => ({
  useGenerate: () => ({
    resume: 'Original Resume Text',
    jobDescription: 'Original JD Text',
    companyName: 'Test Company',
    selectedModel: 'claude-sonnet-4-6',
    setSelectedModel: mockSetSelectedModel,
    setJD: mockSetJD,
    setCompany: mockSetCompany,
    handleResumeChange: mockHandleResumeChange,
    output: null,
    originalOutput: null,
    isLoading: false,
    error: null,
    handleGenerate: mockHandleGenerate,
    handleRefine: mockHandleRefine,
    handleRevert: mockHandleRevert,
    handleRefreshRecommendations: mockHandleRefreshRecommendations,
  }),
}));

// Keeps the page's timeout callback so tests can fire the inactivity lock on demand.
let mockOnInactivityTimeout: (() => void) | undefined;
jest.mock('@/hooks/useInactivityTimeout', () => ({
  useInactivityTimeout: (_minutes: number, onTimeout: () => void) => {
    mockOnInactivityTimeout = onTimeout;
  },
}));

// Mock fetch globally
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => Promise.resolve({ hasServerKey: false }),
  })
) as jest.Mock;

/** Calls the page made to the Dropbox verify endpoint. */
const dropboxVerifyCalls = () =>
  (global.fetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/dropbox/verify');

/** A promise this test resolves by hand, so responses can be ordered. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const jsonResponse = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });

describe('Home Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiKeyState.anthropicKey = 'test-key';
    mockApiKeyState.dropboxToken = 'test-token';
  });

  it('renders input section headers and fields', () => {
    render(<Home />);
    
    // Check main title
    expect(screen.getByText(/Resume Builder/i)).toBeInTheDocument();
    
    // Check fields / sections
    expect(screen.getByText(/Candidate Resume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Job Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/i)).toBeInTheDocument();
  });

  it('renders API key sections', () => {
    render(<Home />);
    expect(screen.getByLabelText(/Claude model/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Anthropic API key')).toBeInTheDocument();
  });

  it('opens the Dropbox setup dialog from the help link', () => {
    render(<Home />);
    expect(screen.queryByRole('dialog', { name: /connect dropbox/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /how do i get a token/i }));
    expect(screen.getByRole('dialog', { name: /connect dropbox/i })).toBeInTheDocument();
  });

  it('does not show a Verify Token button — the check runs on blur', () => {
    render(<Home />);
    expect(screen.queryByRole('button', { name: /verify token/i })).not.toBeInTheDocument();
  });

  it('checks the Dropbox token when the field loses focus', async () => {
    render(<Home />);
    fireEvent.blur(screen.getByLabelText('Dropbox access token'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dropbox/verify',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('does not re-check an unchanged token on a second blur', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ valid: true, account: 'Test User' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    const field = screen.getByLabelText('Dropbox access token');

    fireEvent.blur(field);
    await waitFor(() => expect(dropboxVerifyCalls()).toHaveLength(1));

    fireEvent.blur(field);
    await waitFor(() => expect(screen.getByTestId('field-status-ok')).toBeInTheDocument());
    expect(dropboxVerifyCalls()).toHaveLength(1);
  });

  it('keeps generation available when the Dropbox check fails', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: false, json: () => Promise.resolve({ valid: false, error: 'Invalid token' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    fireEvent.blur(screen.getByLabelText('Dropbox access token'));

    await waitFor(() => expect(screen.getByTestId('field-status-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /generate tailored resume/i })).toBeEnabled();
  });

  it('does not re-check an unchanged token that already failed', async () => {
    // Recording only successes meant every focus/blur re-fired the request for
    // a token we had already rejected.
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ valid: false, error: 'Invalid token' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    const field = screen.getByLabelText('Dropbox access token');

    fireEvent.blur(field);
    await waitFor(() => expect(screen.getByTestId('field-status-error')).toBeInTheDocument());
    expect(dropboxVerifyCalls()).toHaveLength(1);

    fireEvent.blur(field);
    fireEvent.blur(field);
    await waitFor(() => expect(screen.getByTestId('field-status-error')).toBeInTheDocument());
    expect(dropboxVerifyCalls()).toHaveLength(1);
  });

  it('re-checks the same token when the user asks to retry', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ valid: false, error: 'Invalid token' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    fireEvent.blur(screen.getByLabelText('Dropbox access token'));
    await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument());
    expect(dropboxVerifyCalls()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(dropboxVerifyCalls()).toHaveLength(2));
  });

  it('clears a stale verdict as soon as the token is edited', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ valid: true, account: 'Test User' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    const field = screen.getByLabelText('Dropbox access token');

    fireEvent.blur(field);
    await waitFor(() => expect(screen.getByTestId('field-status-ok')).toBeInTheDocument());

    // A green tick over an edited token claims something nobody verified.
    fireEvent.change(field, { target: { value: 'a-different-token' } });

    expect(screen.queryByTestId('field-status-ok')).not.toBeInTheDocument();
    expect(screen.queryByText(/connected as/i)).not.toBeInTheDocument();
  });

  it('reports our own rate limit as a rate limit, not a bad token', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({ success: false, error: { type: 'RATE_LIMIT', message: 'Too many token checks.' } }),
          })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    fireEvent.blur(screen.getByLabelText('Dropbox access token'));

    await waitFor(() => expect(screen.getByTestId('field-status-error')).toBeInTheDocument());
    expect(screen.getByText(/too many checks/i)).toBeInTheDocument();
    expect(screen.queryByText(/dropbox rejected this token/i)).not.toBeInTheDocument();
  });

  it('keeps the verdict tied to the key currently in the field', async () => {
    // A slow check for a key the user has since corrected must not report its
    // verdict against the replacement.
    jest.useFakeTimers();
    try {
      const slowOldKey = deferred<unknown>();
      const fastNewKey = deferred<unknown>();

      (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/models') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          return body.anthropicKey === 'key-A' ? slowOldKey.promise : fastNewKey.promise;
        }
        return Promise.resolve(jsonResponse({ hasServerKey: false }));
      });

      mockApiKeyState.anthropicKey = 'key-A';
      const { rerender } = render(<Home />);
      act(() => { jest.advanceTimersByTime(600); });

      mockApiKeyState.anthropicKey = 'key-B';
      rerender(<Home />);
      act(() => { jest.advanceTimersByTime(600); });

      // The corrected key answers first, and is accepted.
      await act(async () => {
        fastNewKey.resolve(jsonResponse({
          success: true,
          models: [{ id: 'claude-sonnet-4-6', name: 'Sonnet' }],
        }));
      });
      expect(screen.getByTestId('field-status-ok')).toBeInTheDocument();

      // The stale check for the old key lands afterwards and must be ignored.
      await act(async () => {
        slowOldKey.resolve(jsonResponse({
          success: false,
          upstreamStatus: 401,
          error: { type: 'VALIDATION_FAILED', message: 'Anthropic API returned status 401' },
        }));
      });

      expect(screen.queryByTestId('field-status-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('field-status-ok')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not call a rate-limited key rejected', async () => {
    jest.useFakeTimers();
    try {
      (global.fetch as jest.Mock).mockImplementation((url: string) =>
        url === '/api/models'
          ? Promise.resolve(jsonResponse({
              success: false,
              upstreamStatus: 429,
              error: { type: 'RATE_LIMIT', message: 'Anthropic API returned status 429' },
            }))
          : Promise.resolve(jsonResponse({ hasServerKey: false }))
      );

      render(<Home />);
      await act(async () => { jest.advanceTimersByTime(600); });

      expect(screen.getByText(/couldn't reach anthropic/i)).toBeInTheDocument();
      expect(screen.queryByText(/rejected by anthropic/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers a retry only after a failed check', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: false, json: () => Promise.resolve({ valid: false, error: 'Invalid token' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText('Dropbox access token'));
    await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument());
  });
  it('wipes the saved resume and session data when the inactivity lock fires', () => {
    localStorage.setItem(RESUME_STORAGE_KEY, 'Jane Doe resume');
    sessionStorage.setItem('anthropic_key', 'sk-ant-test');
    render(<Home />);

    act(() => mockOnInactivityTimeout?.());

    expect(localStorage.getItem(RESUME_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem('anthropic_key')).toBeNull();
    expect(screen.getByText(/Session Expired/i)).toBeInTheDocument();

    // Pin the overlay's look (jsdom resolves these, not backdrop-filter): it
    // covers the page, above everything, on a near-opaque dark backdrop.
    let overlay: HTMLElement | null = screen.getByText(/Session Expired/i);
    while (overlay && getComputedStyle(overlay).position !== 'fixed') overlay = overlay.parentElement;
    expect(overlay).not.toBeNull();
    const style = getComputedStyle(overlay!);
    expect(style.zIndex).toBe('9999');
    expect(style.backgroundColor).toBe('rgba(15, 17, 23, 0.96)');
    expect([style.top, style.right, style.bottom, style.left]).toEqual(['0px', '0px', '0px', '0px']);
  });
});
