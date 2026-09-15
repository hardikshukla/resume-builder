/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../app/page';
import { DROPBOX_APP_CONSOLE_URL } from '@/lib/constants';

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
    expect(screen.getByLabelText(/Company Name \(Optional\)/i)).toBeInTheDocument();
  });

  it('renders API key sections', () => {
    render(<Home />);
    expect(screen.getByLabelText(/Claude Model/i)).toBeInTheDocument();
  });

  it('renders a "Get a token" link to the Dropbox app console', () => {
    render(<Home />);
    const link = screen.getByRole('link', { name: /get a token/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', DROPBOX_APP_CONSOLE_URL);
    expect(link).toHaveAttribute('href', 'https://www.dropbox.com/developers/apps');
    // The console link must not be personalised with a build-time app key —
    // it would point every visitor at an app only the owner can open.
    expect(link.getAttribute('href')).not.toContain('app_key');
  });

  it('opens the Dropbox token link safely in a new tab', () => {
    render(<Home />);
    const link = screen.getByRole('link', { name: /get a token/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('opens the Dropbox setup dialog from the info button', () => {
    render(<Home />);
    expect(screen.queryByRole('dialog', { name: /connect dropbox/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /how to get a dropbox token/i }));
    expect(screen.getByRole('dialog', { name: /connect dropbox/i })).toBeInTheDocument();
  });
});
