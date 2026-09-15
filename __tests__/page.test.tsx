/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../app/page';

// Mock hooks
jest.mock('@/hooks/useApiKey', () => ({
  useApiKey: () => ({
    anthropicKey: 'test-key',
    dropboxToken: 'test-token',
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
    selectedModel: 'claude-3-5-sonnet-20241022',
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

jest.mock('@/hooks/useInactivityTimeout', () => ({
  useInactivityTimeout: () => {},
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

describe('Home Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    fireEvent.blur(screen.getByLabelText(/Dropbox access token/i));

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
    const field = screen.getByLabelText(/Dropbox access token/i);

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
    fireEvent.blur(screen.getByLabelText(/Dropbox access token/i));

    await waitFor(() => expect(screen.getByTestId('field-status-error')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /generate tailored resume/i })).toBeEnabled();
  });

  it('offers a retry only after a failed check', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url === '/api/dropbox/verify'
        ? Promise.resolve({ ok: false, json: () => Promise.resolve({ valid: false, error: 'Invalid token' }) })
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ hasServerKey: false }) })
    );

    render(<Home />);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText(/Dropbox access token/i));
    await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument());
  });
});
