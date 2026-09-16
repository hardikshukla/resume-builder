/**
 * useGenerate.cache.test.ts — behaviour of useGenerate that depends on real
 * storage and hashing: the generation cache, the JD analysis cache, refine
 * merging, and refreshing recommendations.
 *
 * Unlike useGenerate.test.ts, storage is not stubbed here, and SHA-256 comes
 * from Node's WebCrypto, so cache keys are real.
 *
 * @jest-environment jsdom
 */
import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { renderHook, act } from '@testing-library/react';
import { useGenerate } from '@/hooks/useGenerate';
import { ResumeBuilderOutput } from '@/types';

Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true });
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const JD_KEYWORDS = { seniority: 'Senior', companyName: null, mustHaveSkills: ['React'], niceToHaveSkills: [], gapsDetected: [] };

function makeOutput(overrides: Partial<ResumeBuilderOutput['gapAnalysis']> = {}): ResumeBuilderOutput {
  return {
    gapAnalysis: {
      matchScore: 70,
      strongMatches: ['React'],
      dealbreakers: [],
      recommendations: [
        { id: 'rec-1', claim: 'Add Kubernetes', targetSection: 'Skills', evidenceRequired: 'x', evidenceFound: 'y', riskLevel: 'medium', resolvesDealbreakers: [] },
      ],
      keywordsAdded: ['GraphQL'],
      summaryChanges: 'Initial.',
      ...overrides,
    },
    resume: {
      name: 'Jane',
      summary: 'Original summary',
      skills: [{ category: 'Languages', items: ['Python', 'Go'] }],
      experience: [],
    },
    coverLetter: { subject: 'Hello', body: 'First paragraph.\n\nSecond paragraph.' },
  };
}

/** Routes fetch by URL; `generate` may be a value or a function of the body. */
function respond(routes: { analyze?: unknown; generate?: unknown | ((body: Record<string, unknown>) => unknown) }) {
  mockFetch.mockImplementation((url: string, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    const data = url.includes('/api/analyze-jd')
      ? routes.analyze
      : typeof routes.generate === 'function'
        ? (routes.generate as (b: Record<string, unknown>) => unknown)(body)
        : routes.generate;
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data }) });
  });
}

const callsTo = (path: string) => mockFetch.mock.calls.filter(([url]) => String(url).includes(path));
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body);

async function setup(resume = 'Resume text', jd = 'JD text') {
  const hook = renderHook(() => useGenerate());
  await act(async () => {
    hook.result.current.handleResumeChange(resume);
    hook.result.current.setJD(jd);
  });
  return hook;
}

beforeEach(() => {
  mockFetch.mockReset();
  sessionStorage.clear();
  localStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ── Generation cache ─────────────────────────────────────────────────────────

describe('generation cache', () => {
  it('serves a repeat generation from cache without any request', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup();

    await act(async () => { await result.current.handleGenerate('sk-ant'); });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockFetch.mockClear();
    await act(async () => { await result.current.handleGenerate('sk-ant'); });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.output?.gapAnalysis.matchScore).toBe(70);
    // The cached JD analysis is restored alongside the output.
    expect(result.current.jdKeywords).toEqual(JD_KEYWORDS);
  });

  it('reuses the JD analysis when only the resume changes', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup('Resume one');
    await act(async () => { await result.current.handleGenerate(); });

    await act(async () => { result.current.handleResumeChange('Resume two'); });
    mockFetch.mockClear();
    await act(async () => { await result.current.handleGenerate(); });

    expect(callsTo('/api/analyze-jd')).toHaveLength(0);
    expect(callsTo('/api/generate')).toHaveLength(1);
    expect(bodyOf(callsTo('/api/generate')[0]).jdKeywords).toEqual(JD_KEYWORDS);
  });

  it('keeps at most 10 generations, evicting the oldest', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup('Resume 0');
    for (let i = 0; i <= 10; i++) {
      await act(async () => { result.current.handleResumeChange(`Resume ${i}`); });
      await act(async () => { await result.current.handleGenerate(); });
    }

    const runKeys = Object.keys(sessionStorage).filter((k) => k.startsWith('rb_cache_run_'));
    expect(runKeys).toHaveLength(10);
    expect(JSON.parse(sessionStorage.getItem('rb_cache_keys') ?? '[]')).toHaveLength(10);

    // The first resume was evicted, so generating it again costs a request.
    await act(async () => { result.current.handleResumeChange('Resume 0'); });
    mockFetch.mockClear();
    await act(async () => { await result.current.handleGenerate(); });
    expect(callsTo('/api/generate')).toHaveLength(1);
  });
});

// ── Refine merging ───────────────────────────────────────────────────────────

describe('refine', () => {
  it('sends the edited output and the cached JD analysis', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup();
    await act(async () => { await result.current.handleGenerate(); });
    act(() => { result.current.handleManualEdit('resume.summary', 'My summary'); });

    respond({ generate: { resume: makeOutput().resume, coverLetter: makeOutput().coverLetter, updatedMatchScore: 80 } });
    await act(async () => { await result.current.handleRefine([], 'sk-ant'); });

    const body = bodyOf(callsTo('/api/generate').at(-1)!);
    expect(body.mode).toBe('refine');
    expect(body.currentOutput.resume.summary).toBe('My summary');
    expect(body.jdKeywords).toEqual(JD_KEYWORDS);
    expect(result.current.output?.gapAnalysis.matchScore).toBe(80);
  });

  it('re-applies cover letter paragraph and skills edits that still match', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup();
    await act(async () => { await result.current.handleGenerate(); });
    act(() => {
      result.current.handleManualEdit('coverLetter.body[1]', 'My second paragraph.');
      result.current.handleManualEdit('resume.skills[0].items', 'Python, Go, Rust');
    });

    // Refined text differs slightly (within tolerance) in both places.
    const refined = makeOutput();
    refined.coverLetter = { subject: 'Hello', body: 'First paragraph.\n\nSecond paragraph!' };
    refined.resume.skills = [{ category: 'Languages', items: ['Python', 'Gox'] }];
    respond({ generate: { resume: refined.resume, coverLetter: refined.coverLetter, updatedMatchScore: 75 } });
    await act(async () => { await result.current.handleRefine([]); });

    expect(result.current.output?.coverLetter?.body).toBe('First paragraph.\n\nMy second paragraph.');
    expect(result.current.output?.resume.skills?.[0].items).toEqual(['Python', 'Go', 'Rust']);
    expect(result.current.orphanedEdits).toEqual([]);
    // Baselines move to the refined text.
    expect(result.current.manualEdits).toEqual([
      { path: 'coverLetter.body[1]', originalValue: 'Second paragraph!', editedValue: 'My second paragraph.' },
      { path: 'resume.skills[0].items', originalValue: 'Python, Gox', editedValue: 'Python, Go, Rust' },
    ]);
  });

  it('orphans edits whose field disappeared, and accumulates orphans across refines', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup();
    await act(async () => { await result.current.handleGenerate(); });
    act(() => { result.current.handleManualEdit('resume.summary', 'My summary'); });

    // First refine: the summary is gone entirely (not a string any more).
    const noSummary = { ...makeOutput().resume, summary: undefined };
    respond({ generate: { resume: noSummary, coverLetter: makeOutput().coverLetter, updatedMatchScore: 70 } });
    await act(async () => { await result.current.handleRefine([]); });
    expect(result.current.orphanedEdits).toHaveLength(1);
    expect(result.current.manualEdits).toEqual([]);

    // Second refine with a new, unmatched edit: orphans accumulate.
    act(() => { result.current.handleManualEdit('coverLetter.body[0]', 'Replaced first.'); });
    respond({ generate: { resume: noSummary, coverLetter: { subject: 'Hello', body: 'Totally different opening text.' }, updatedMatchScore: 70 } });
    await act(async () => { await result.current.handleRefine([]); });
    expect(result.current.orphanedEdits.map((e) => e.path)).toEqual(['resume.summary', 'coverLetter.body[0]']);
  });
});

// ── Refresh recommendations ──────────────────────────────────────────────────

describe('handleRefreshRecommendations', () => {
  it('appends only new recommendations and keeps score-related fields', async () => {
    respond({ analyze: JD_KEYWORDS, generate: makeOutput() });
    const { result } = await setup();
    await act(async () => { await result.current.handleGenerate(); });

    const fresh = makeOutput({
      matchScore: 99,
      strongMatches: ['Different'],
      keywordsAdded: ['Different'],
      summaryChanges: 'Fresh summary changes.',
      recommendations: [
        // Same claim, different case/whitespace: a duplicate.
        { id: 'rec-9', claim: '  add kubernetes ', targetSection: 'Skills', evidenceRequired: 'x', evidenceFound: 'y', riskLevel: 'low', resolvesDealbreakers: [] },
        { id: 'rec-10', claim: 'Mention Terraform', targetSection: 'Skills', evidenceRequired: 'x', evidenceFound: 'y', riskLevel: 'high', resolvesDealbreakers: [] },
      ],
    });
    respond({ generate: fresh });
    mockFetch.mockClear();
    await act(async () => { await result.current.handleRefreshRecommendations('sk-ant'); });

    const body = bodyOf(callsTo('/api/generate')[0]);
    expect(body.mode).toBe('generate');
    // The current (possibly edited) resume is sent back as text.
    expect(body.resume).toContain('Original summary');
    expect(body.jdKeywords).toEqual(JD_KEYWORDS);

    const gap = result.current.output!.gapAnalysis;
    expect(gap.recommendations.map((r) => r.id)).toEqual(['rec-1', 'rec-10']);
    expect(gap.matchScore).toBe(70);
    expect(gap.strongMatches).toEqual(['React']);
    expect(gap.keywordsAdded).toEqual(['GraphQL']);
    // Other analysis fields come from the fresh response.
    expect(gap.summaryChanges).toBe('Fresh summary changes.');
  });
});
