/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
