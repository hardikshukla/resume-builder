/**
 * __tests__/useGenerate.manualEdit.test.ts
 * Tests for manual edits and fuzzy merge in the useGenerate hook.
 *
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useGenerate } from '../hooks/useGenerate';

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
  configurable: true,
});

global.TextEncoder = class {
  encode(s: string) {
    return new Uint8Array(Buffer.from(s));
  }
} as unknown as typeof TextEncoder;

const mockFetch = jest.fn();
global.fetch = mockFetch;

const initialOutput = {
  resume: {
    name: 'Alice',
    summary: 'Original Summary String',
    experience: [
      {
        company: 'Google',
        bullets: ['Original bullet one', 'Original bullet two'],
      },
    ],
  },
  coverLetter: 'Original Cover Letter Text',
  gapAnalysis: {
    matchScore: 80,
    recommendations: [],
  },
};

describe('useGenerate — Manual Edits & Fuzzy Merge', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    sessionStorage.clear();
    jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  const setupHook = async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/analyze-jd')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { mustHaveSkills: [], niceToHaveSkills: [], gapsDetected: [] },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { ...initialOutput },
        }),
      });
    });

    const { result } = renderHook(() => useGenerate());

    await act(async () => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    return result;
  };

  it('allows manual edits and updates output & manualEdits state', async () => {
    const result = await setupHook();

    expect(result.current.output?.resume.summary).toBe('Original Summary String');
    expect(result.current.manualEdits).toHaveLength(0);

    act(() => {
      result.current.handleManualEdit('resume.summary', 'My Custom Summary');
    });

    expect(result.current.output?.resume.summary).toBe('My Custom Summary');
    expect(result.current.manualEdits).toEqual([
      {
        path: 'resume.summary',
        originalValue: 'Original Summary String',
        editedValue: 'My Custom Summary',
      },
    ]);
  });

  it('keeps the first original value if the same path is edited multiple times', async () => {
    const result = await setupHook();

    act(() => {
      result.current.handleManualEdit('resume.summary', 'First Edit');
    });
    act(() => {
      result.current.handleManualEdit('resume.summary', 'Second Edit');
    });

    expect(result.current.output?.resume.summary).toBe('Second Edit');
    expect(result.current.manualEdits).toEqual([
      {
        path: 'resume.summary',
        originalValue: 'Original Summary String',
        editedValue: 'Second Edit',
      },
    ]);
  });

  it('performs fuzzy merge during refine - preserves close match and orphans distant match', async () => {
    const result = await setupHook();

    // 1. Make 2 edits
    act(() => {
      result.current.handleManualEdit('resume.experience[0].bullets[0]', 'My Edited Bullet One');
      result.current.handleManualEdit('resume.experience[0].bullets[1]', 'My Edited Bullet Two');
    });

    expect(result.current.manualEdits).toHaveLength(2);

    // 2. Refined response from LLM:
    // Bullet 0: "Original bullet 1" (dist = 3 from "Original bullet one")
    // Bullet 1: "A completely rewritten bullet point" (dist = 22 from "Original bullet two")
    const refinedData = {
      resume: {
        name: 'Alice',
        summary: 'Original Summary String',
        experience: [
          {
            company: 'Google',
            bullets: [
              'Original bullet 1',
              'A completely rewritten bullet point that is totally different',
            ],
          },
        ],
      },
      coverLetter: 'Original Cover Letter Text',
      updatedMatchScore: 85,
    };

    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: refinedData }),
      });
    });

    await act(async () => {
      const refinedSuccess = await result.current.handleRefine([]);
      expect(refinedSuccess).toBe(true);
    });

    // Expecting:
    // Bullet 0 edited version applied because 'Original bullet 1' is distance 3 from 'Original bullet one'
    expect(result.current.output!.resume.experience![0].bullets[0]).toBe('My Edited Bullet One');

    // Bullet 1 edited version NOT applied because 'A completely rewritten...' is distance > 3 from 'Original bullet two'
    expect(result.current.output!.resume.experience![0].bullets[1]).toBe(
      'A completely rewritten bullet point that is totally different'
    );

    // Bullet 0 should remain in manualEdits (updated originalValue baseline)
    expect(result.current.manualEdits).toEqual([
      {
        path: 'resume.experience[0].bullets[0]',
        originalValue: 'Original bullet 1',
        editedValue: 'My Edited Bullet One',
      },
    ]);

    // Bullet 1 should be in orphanedEdits
    expect(result.current.orphanedEdits).toEqual([
      {
        path: 'resume.experience[0].bullets[1]',
        originalValue: 'Original bullet two',
        editedValue: 'My Edited Bullet Two',
      },
    ]);
  });

  it('resets manual edits on revert', async () => {
    const result = await setupHook();

    act(() => {
      result.current.handleManualEdit('resume.summary', 'Modified');
    });
    expect(result.current.manualEdits).toHaveLength(1);

    act(() => {
      result.current.handleRevert();
    });

    expect(result.current.output?.resume.summary).toBe('Original Summary String');
    expect(result.current.manualEdits).toHaveLength(0);
    expect(result.current.orphanedEdits).toHaveLength(0);
  });

  it('resets manual edits on fresh generate', async () => {
    const result = await setupHook();

    act(() => {
      result.current.handleManualEdit('resume.summary', 'Modified');
    });
    expect(result.current.manualEdits).toHaveLength(1);

    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { ...initialOutput } }),
      });
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(result.current.manualEdits).toHaveLength(0);
    expect(result.current.orphanedEdits).toHaveLength(0);
  });

  it('correctly processes and updates comma-separated skills items', async () => {
    const result = await setupHook();
    
    // Initial competency items is empty or not in initialOutput. Let's make sure it matches structure:
    // we mocked initialOutput.resume.skills as empty array: skills: []
    // Let's manually inject skills to test path: resume.skills[0].items
    act(() => {
      // Direct update of output state to setup skills structure
      result.current.handleManualEdit('resume.skills[0]', { category: 'Languages', items: ['Python', 'Go'] } as any);
    });

    act(() => {
      result.current.handleManualEdit('resume.skills[0].items', 'Python, Go, JavaScript');
    });

    expect(result.current.output!.resume.skills![0].items).toEqual(['Python', 'Go', 'JavaScript']);
    expect(result.current.manualEdits).toContainEqual({
      path: 'resume.skills[0].items',
      originalValue: 'Python, Go',
      editedValue: 'Python, Go, JavaScript',
    });
  });

  it('correctly manages cover letter paragraph indexes', async () => {
    const result = await setupHook();

    // Mock cover letter structure
    act(() => {
      result.current.handleManualEdit('coverLetter', { subject: 'Application for SWE', body: 'First paragraph.\nSecond paragraph.' } as any);
    });

    // Edit paragraph 1 (zero-indexed: Second paragraph)
    act(() => {
      result.current.handleManualEdit('coverLetter.body[1]', 'Modified second paragraph.');
    });

    expect(result.current.output?.coverLetter?.body).toBe('First paragraph.\n\nModified second paragraph.');
    expect(result.current.manualEdits).toContainEqual({
      path: 'coverLetter.body[1]',
      originalValue: 'Second paragraph.',
      editedValue: 'Modified second paragraph.',
    });
  });
});
