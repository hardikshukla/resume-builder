/**
 * __tests__/useGenerate.test.ts
 * Unit tests for the useGenerate hook.
 *
 * Run: npx jest __tests__/useGenerate.test.ts
 *
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useGenerate } from '../hooks/useGenerate';

// ── Polyfill crypto.subtle for jsdom ─────────────────────────────────────────
// jsdom doesn't expose crypto.subtle; mock computeHash so cache is never hit.
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
  configurable: true,
});
// Also stub TextEncoder which is used inside computeHash
global.TextEncoder = class {
  encode(s: string) { return new Uint8Array(Buffer.from(s)); }
} as unknown as typeof TextEncoder;

// ── Global fetch mock ─────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Silence console noise from the hook
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockFetch.mockReset();
  // Clear sessionStorage between tests
  sessionStorage.clear();
  // Silence localStorage in jsdom (not available for real, just stub)
  jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const successfulOutput = {
  gapAnalysis: {
    matchScore: 80,
    strongMatches: ['Python'],
    gaps: [],
    dealbreakers: [],
    recommendations: [],
    keywordsAdded: [],
    missingKeywords: [],
    summaryChanges: 'None.',
    extractedCompanyName: 'Acme Corp',
  },
  resume: {
    name: 'Jane Doe',
    contact: { email: 'jane@example.com', phone: null, linkedin: null, github: null, location: null },
    summary: 'Engineer.',
    skills: [],
    experience: [],
    projects: [],
    education: [],
  },
};

// ── Initial state ─────────────────────────────────────────────────────────────

describe('useGenerate — initial state', () => {
  it('starts with empty strings and no output', () => {
    const { result } = renderHook(() => useGenerate());
    expect(result.current.resume).toBe('');
    expect(result.current.jobDescription).toBe('');
    expect(result.current.companyName).toBe('');
    expect(result.current.output).toBeNull();
    expect(result.current.originalOutput).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ── State setters ─────────────────────────────────────────────────────────────

describe('useGenerate — state setters', () => {
  it('setJD updates jobDescription', () => {
    const { result } = renderHook(() => useGenerate());
    act(() => { result.current.setJD('Software Engineer at Acme'); });
    expect(result.current.jobDescription).toBe('Software Engineer at Acme');
  });

  it('setCompany updates companyName', () => {
    const { result } = renderHook(() => useGenerate());
    act(() => { result.current.setCompany('Acme Corp'); });
    expect(result.current.companyName).toBe('Acme Corp');
  });

  it('handleResumeChange updates resume', () => {
    const { result } = renderHook(() => useGenerate());
    act(() => { result.current.handleResumeChange('My resume text'); });
    expect(result.current.resume).toBe('My resume text');
  });

  it('setSelectedModel updates selectedModel', () => {
    const { result } = renderHook(() => useGenerate());
    act(() => { result.current.setSelectedModel('claude-3-opus-20240229'); });
    expect(result.current.selectedModel).toBe('claude-3-opus-20240229');
  });
});

// ── handleGenerate ─────────────────────────────────────────────────────────────

describe('useGenerate — handleGenerate', () => {
  it('sets output on successful API response', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/analyze-jd')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { seniority: 'Senior', companyName: 'Acme Corp', mustHaveSkills: [], niceToHaveSkills: [], gapsDetected: [] },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: successfulOutput }),
      });
    });

    const { result } = renderHook(() => useGenerate());

    // Set state then immediately call generate inside a single async act
    await act(async () => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });

    await act(async () => {
      await result.current.handleGenerate('sk-ant-test');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.output).toMatchObject({ gapAnalysis: { matchScore: 80 } });
    expect(result.current.originalOutput).toMatchObject({ gapAnalysis: { matchScore: 80 } });
    expect(result.current.error).toBeNull();
  });

  it('sets typed error on API failure response', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/analyze-jd')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { seniority: 'Senior', companyName: 'Acme Corp', mustHaveSkills: [], niceToHaveSkills: [], gapsDetected: [] },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: false,
          error: { type: 'RATE_LIMIT', message: 'Too many requests', retryAfterSeconds: 30 },
        }),
      });
    });

    const { result } = renderHook(() => useGenerate());
    await act(async () => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });

    await act(async () => {
      await result.current.handleGenerate('sk-ant-test');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.output).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.success).toBe(false);
    expect(result.current.error?.error.type).toBe('RATE_LIMIT');
  });

  it('sets typed error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

    const { result } = renderHook(() => useGenerate());
    await act(async () => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });

    await act(async () => {
      await result.current.handleGenerate('sk-ant-test');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.error.message).toContain('fetch failed');
  });
});

// ── handleRevert ──────────────────────────────────────────────────────────────

describe('useGenerate — handleRevert', () => {
  it('restores originalOutput to output after refinement', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/analyze-jd')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { seniority: 'Senior', companyName: 'Acme Corp', mustHaveSkills: [], niceToHaveSkills: [], gapsDetected: [] },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: successfulOutput }),
      });
    });

    const { result } = renderHook(() => useGenerate());
    await act(async () => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });
    await act(async () => { await result.current.handleGenerate('sk-ant-test'); });
    await waitFor(() => expect(result.current.output).not.toBeNull());

    // Mock refine call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { resume: successfulOutput.resume, coverLetter: null, updatedMatchScore: 95 } }),
    });

    await act(async () => {
      await result.current.handleRefine([], 'sk-ant-test');
    });

    // Revert
    act(() => { result.current.handleRevert(); });

    expect(result.current.output?.gapAnalysis.matchScore).toBe(80); // back to original
  });
});

// ── clearError ────────────────────────────────────────────────────────────────

describe('useGenerate — clearError', () => {
  it('clears the error state', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useGenerate());
    act(() => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });
    await act(async () => { await result.current.handleGenerate('sk-ant-test'); });

    expect(result.current.error).not.toBeNull();

    act(() => { result.current.clearError(); });

    expect(result.current.error).toBeNull();
  });
});
