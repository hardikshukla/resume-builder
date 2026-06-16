# Six Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six code-review findings: two intertwined bugs where the retry button disappears (fixed by moving `isGenerationError` into the hook), a missing system-prompt instruction for blind-posting company names, an unused `useRef` import, incomplete print-CSS for skills, and leftover `as unknown as` casts that are now unnecessary.

**Architecture:** Four independent tasks, ordered so the hook rewrite (Task 1) lands first. Tasks 2–4 touch different files and can be applied in any order after Task 1 commits.

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, `@anthropic-ai/sdk` v0.92.0, Jest + `@testing-library/react` (`renderHook` / `act` / `waitFor`), MUI v5.

---

## Files touched

| File | Task | What changes |
|---|---|---|
| `hooks/useGenerate.ts` | 1 | Add `isGenerationError` state; set in 3 error paths inside `handleGenerate`; export; remove unused `useRef` import |
| `app/page.tsx` | 1 | Destructure `isGenerationError` from hook; delete 3 state/refs + `useEffect` + one line in `handleGenerateClick`; remove `useRef` from React import |
| `__tests__/useGenerate.test.ts` | 1 | Add 4 tests for `isGenerationError` behaviour |
| `lib/prompt.ts` | 2 | Add one instruction sentence to `JD_EXTRACTION_SYSTEM_PROMPT` |
| `__tests__/prompt.test.ts` | 2 | Add 1 test asserting the hint instruction is present |
| `lib/llm/anthropic.ts` | 3 | Remove all 7 `as unknown as` casts |
| `components/ResumePreview.tsx` | 4 | Add `className="skills-grid"` to outer skills container `Box` |
| `app/page.tsx` | 4 | Add `.skills-grid` CSS rule to `@media print` block |

---

## Task 1: Move `isGenerationError` into `useGenerate` hook

**Why:** The page-level tracking (`isGenerateFlowRef` + `prevIsLoadingRef` + `useEffect`) has two races. Bug 1: `onRetry` calls `handleGenerate` directly, never setting `isGenerateFlowRef.current = true`, so the retry button vanishes after the first retry failure. Bug 2: `handleGenerate` calls `setError(null)` synchronously before `await computeHash(...)`, which triggers the `useEffect` with `!error` and clears the ref before the API call starts. Fix: own the flag inside the hook where the errors are set.

**Files:**
- Modify: `hooks/useGenerate.ts`
- Modify: `app/page.tsx`
- Test: `__tests__/useGenerate.test.ts`

---

- [ ] **Step 1: Write 4 failing tests in `__tests__/useGenerate.test.ts`**

Append a new `describe` block at the end of the file (after the last closing `});`):

```typescript
// ── isGenerationError ─────────────────────────────────────────────────────────

describe('useGenerate — isGenerationError', () => {
  it('starts as false', () => {
    const { result } = renderHook(() => useGenerate());
    expect(result.current.isGenerationError).toBe(false);
  });

  it('is true after handleGenerate fails with an API error response', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/analyze-jd')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { seniority: 'Mid', companyName: null, mustHaveSkills: [], niceToHaveSkills: [], gapsDetected: [] },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: false,
          error: { type: 'FATAL', message: 'Internal server error' },
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

    expect(result.current.error).not.toBeNull();
    expect(result.current.isGenerationError).toBe(true);
  });

  it('is true after handleGenerate fails with a network error', async () => {
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
    expect(result.current.isGenerationError).toBe(true);
  });

  it('resets to false when handleGenerate is called again', async () => {
    // First call fails
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useGenerate());
    await act(async () => {
      result.current.handleResumeChange('Resume text');
      result.current.setJD('JD text');
    });

    await act(async () => {
      await result.current.handleGenerate('sk-ant-test');
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isGenerationError).toBe(true);

    // Second call also fails — isGenerationError should be true again (not permanently cleared)
    mockFetch.mockRejectedValueOnce(new Error('still down'));
    await act(async () => {
      await result.current.handleGenerate('sk-ant-test');
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isGenerationError).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npx jest __tests__/useGenerate.test.ts -t "isGenerationError" --no-coverage
```

Expected: **FAIL** — `result.current.isGenerationError` is `undefined` because the hook doesn't export it yet.

---

- [ ] **Step 3: Update `hooks/useGenerate.ts`**

**3a — Remove `useRef` from the import (line 1):**

```typescript
// BEFORE
import { useState, useCallback, useEffect, useRef } from 'react';

// AFTER
import { useState, useCallback, useEffect } from 'react';
```

**3b — Add `isGenerationError` state after `setFatalError` (around line 111):**

```typescript
// BEFORE
  const setFatalError = useCallback((message: string) => {
    setError({ success: false, error: { type: 'FATAL', message } });
  }, []);

  const [manualEdits, setManualEdits] = useState<ManualEdit[]>([]);
```

```typescript
// AFTER
  const setFatalError = useCallback((message: string) => {
    setError({ success: false, error: { type: 'FATAL', message } });
  }, []);

  const [isGenerationError, setIsGenerationError] = useState(false);

  const [manualEdits, setManualEdits] = useState<ManualEdit[]>([]);
```

**3c — Reset the flag and set it on all 3 error paths inside `handleGenerate` (lines 195–283):**

```typescript
// BEFORE
  const handleGenerate = useCallback(
    async (anthropicKey?: string) => {
      setError(null);
      setManualEdits([]);
      setOrphanedEdits([]);

      try {
        ...
          const jdJson = await jdRes.json();
          if (!jdJson.success) {
            setError(jdJson as ApiErrorResponse);
            return;
          }
        ...
        const json = await res.json();
        if (!json.success) {
          setError(json as ApiErrorResponse);
          return;
        }
        ...
      } catch (e) {
        setError(toApiErrorResponse(e));
      } finally {
        setIsLoading(false);
      }
    },
```

```typescript
// AFTER
  const handleGenerate = useCallback(
    async (anthropicKey?: string) => {
      setIsGenerationError(false);
      setError(null);
      setManualEdits([]);
      setOrphanedEdits([]);

      try {
        ...
          const jdJson = await jdRes.json();
          if (!jdJson.success) {
            setIsGenerationError(true);
            setError(jdJson as ApiErrorResponse);
            return;
          }
        ...
        const json = await res.json();
        if (!json.success) {
          setIsGenerationError(true);
          setError(json as ApiErrorResponse);
          return;
        }
        ...
      } catch (e) {
        setIsGenerationError(true);
        setError(toApiErrorResponse(e));
      } finally {
        setIsLoading(false);
      }
    },
```

**3d — Add `isGenerationError` to the hook return object (around line 517):**

```typescript
// BEFORE
  return {
    resume,
    jobDescription,
    companyName,
    selectedModel,
    setSelectedModel,
    setResume,
    setJD,
    setCompany,
    handleResumeChange,
    output,
    originalOutput,
    jdKeywords,
    isLoading,
    error,
    setFatalError,
    clearError,
    handleGenerate,
    handleRefine,
    handleRevert,
    handleRefreshRecommendations,
    manualEdits,
    orphanedEdits,
    clearOrphanedEdits,
    handleManualEdit,
  };
```

```typescript
// AFTER
  return {
    resume,
    jobDescription,
    companyName,
    selectedModel,
    setSelectedModel,
    setResume,
    setJD,
    setCompany,
    handleResumeChange,
    output,
    originalOutput,
    jdKeywords,
    isLoading,
    error,
    isGenerationError,
    setFatalError,
    clearError,
    handleGenerate,
    handleRefine,
    handleRevert,
    handleRefreshRecommendations,
    manualEdits,
    orphanedEdits,
    clearOrphanedEdits,
    handleManualEdit,
  };
```

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
npx jest __tests__/useGenerate.test.ts -t "isGenerationError" --no-coverage
```

Expected: **PASS** — all 4 new tests green.

---

- [ ] **Step 5: Update `app/page.tsx`**

**5a — Remove `useRef` from the React import (line 3):**

```typescript
// BEFORE
import React, { useState, useEffect, useRef, useMemo } from 'react';

// AFTER
import React, { useState, useEffect, useMemo } from 'react';
```

**5b — Add `isGenerationError` to the `useGenerate()` destructuring (around line 65):**

```typescript
// BEFORE
    isLoading,
    error,
    setFatalError,
    clearError,

// AFTER
    isLoading,
    error,
    isGenerationError,
    setFatalError,
    clearError,
```

**5c — Delete the 3-piece tracking machinery (lines 96–109). Remove these lines entirely:**

```typescript
// DELETE all of the following:
  const [isGenerationError, setIsGenerationError] = useState(false);
  const prevIsLoadingRef = useRef(false);
  const isGenerateFlowRef = useRef(false);
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && error && isGenerateFlowRef.current) {
      setIsGenerationError(true);
      isGenerateFlowRef.current = false;
    }
    if (!error) {
      setIsGenerationError(false);
      isGenerateFlowRef.current = false;
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, error]);
```

**5d — Remove `isGenerateFlowRef.current = true;` from `handleGenerateClick` (line 130):**

```typescript
// BEFORE
  const handleGenerateClick = async () => {
    isGenerateFlowRef.current = true;
    setActiveStep(1);

// AFTER
  const handleGenerateClick = async () => {
    setActiveStep(1);
```

- [ ] **Step 6: Run the full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass. The `setIsGenerationError` references in `page.tsx` are now gone; the `isGenerationError` value comes from the hook.

- [ ] **Step 7: Commit**

```bash
git add hooks/useGenerate.ts app/page.tsx __tests__/useGenerate.test.ts
git commit -m "fix: move isGenerationError into useGenerate hook; fix retry button races"
```

---

## Task 2: Add CANDIDATE IS APPLYING TO instruction to `JD_EXTRACTION_SYSTEM_PROMPT`

**Why:** The system prompt tells Claude to extract `companyName` from the JD body text. On blind postings (recruiter-anonymized JDs), the JD body has no company name, but the user message always includes `CANDIDATE IS APPLYING TO: <company>` when the user filled in the company field. Without an explicit instruction, Claude may ignore the hint and return `null` for `companyName`.

**Files:**
- Modify: `lib/prompt.ts`
- Test: `__tests__/prompt.test.ts`

---

- [ ] **Step 1: Write a failing test in `__tests__/prompt.test.ts`**

The file already imports `JD_EXTRACTION_SYSTEM_PROMPT`. Add one test inside the existing `describe('JD_EXTRACTION_SYSTEM_PROMPT', ...)` block:

```typescript
  it('instructs the model to use the CANDIDATE IS APPLYING TO hint', () => {
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('CANDIDATE IS APPLYING TO');
  });
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx jest __tests__/prompt.test.ts -t "CANDIDATE IS APPLYING TO" --no-coverage
```

Expected: **FAIL** — the constant doesn't contain that string yet.

- [ ] **Step 3: Add the instruction sentence to `lib/prompt.ts`**

```typescript
// BEFORE
export const JD_EXTRACTION_SYSTEM_PROMPT = `You are an expert ATS parser and technical recruiter. Your task is to analyze the job description and extract structural keywords.

Output a single JSON object matching the following structure. Do NOT include markdown blocks or any text other than the JSON:

// AFTER
export const JD_EXTRACTION_SYSTEM_PROMPT = `You are an expert ATS parser and technical recruiter. Your task is to analyze the job description and extract structural keywords.

If the user message contains a line starting with "CANDIDATE IS APPLYING TO:", use that value as the companyName — this takes priority over any company name found in the JD body (e.g. a staffing agency that posted on behalf of a client).

Output a single JSON object matching the following structure. Do NOT include markdown blocks or any text other than the JSON:
```

- [ ] **Step 4: Run the prompt tests**

```bash
npx jest __tests__/prompt.test.ts --no-coverage
```

Expected: **PASS** — all existing tests still pass and the new one passes.

- [ ] **Step 5: Run the full suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/prompt.ts __tests__/prompt.test.ts
git commit -m "fix: add CANDIDATE IS APPLYING TO instruction to JD_EXTRACTION_SYSTEM_PROMPT"
```

---

## Task 3: Remove stale `as unknown as` casts in `lib/llm/anthropic.ts`

**Why:** SDK v0.92.0 types `ttl?: '5m' | '1h'` on `cache_control` natively (`node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts`). The 7 `as unknown as` casts that bypassed TypeScript are now dead weight — they mask future type errors.

**Files:**
- Modify: `lib/llm/anthropic.ts`

No new test needed — the TypeScript compiler (`npm run build`) validates the types, and the existing test suite verifies runtime behaviour.

---

- [ ] **Step 1: Remove the 7 casts in `lib/llm/anthropic.ts`**

Apply each change below. All are in the `callAnthropic` function (lines 162–218).

**analyze-jd user message block (line ~170):**
```typescript
// BEFORE
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}${payload.companyName ? `\n\nCANDIDATE IS APPLYING TO: ${payload.companyName}` : ''}`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,

// AFTER
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}${payload.companyName ? `\n\nCANDIDATE IS APPLYING TO: ${payload.companyName}` : ''}`,
      },
```

**generate mode — resume block (line ~179):**
```typescript
// BEFORE
      {
        type: 'text',
        text: `CANDIDATE RESUME:\n${payload.resume}`,
        cache_control: { type: 'ephemeral', ttl: '1h' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,

// AFTER
      {
        type: 'text',
        text: `CANDIDATE RESUME:\n${payload.resume}`,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
```

**generate mode — JD block (line ~184):**
```typescript
// BEFORE
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}\n${payload.companyName ? `COMPANY NAME: ${payload.companyName}\n` : ''}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam

// AFTER
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}\n${payload.companyName ? `COMPANY NAME: ${payload.companyName}\n` : ''}`,
      },
```

**generate mode — jdKeywords push (line ~192):**
```typescript
// BEFORE
      messagesContent.push({
        type: 'text',
        text: `<jd_keywords>\n${JSON.stringify(payload.jdKeywords, null, 2)}\n</jd_keywords>`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam);

// AFTER
      messagesContent.push({
        type: 'text',
        text: `<jd_keywords>\n${JSON.stringify(payload.jdKeywords, null, 2)}\n</jd_keywords>`,
      });
```

**refine mode — currentOutput block (line ~204):**
```typescript
// BEFORE
      {
        type: 'text',
        text: `CURRENT RESUME AND COVER LETTER (JSON):\n${JSON.stringify(payload.currentOutput, null, 2)}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,

// AFTER
      {
        type: 'text',
        text: `CURRENT RESUME AND COVER LETTER (JSON):\n${JSON.stringify(payload.currentOutput, null, 2)}`,
      },
```

**refine mode — recList block (line ~209):**
```typescript
// BEFORE
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam

// AFTER
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`,
      },
```

**system block (line ~217):**
```typescript
// BEFORE
  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } } as unknown as Anthropic.Beta.Messages.BetaTextBlockParam
  ];

// AFTER
  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } },
  ];
```

Also update the `messagesContent` array type annotation at line ~160 — the array type `Anthropic.Beta.Messages.BetaContentBlockParam[]` is still correct; remove only the per-element casts (done above). The variable declaration stays as-is.

- [ ] **Step 2: Confirm TypeScript compiles cleanly**

```bash
npm run build 2>&1 | grep -E "error TS|warning" | head -20
```

Expected: no TypeScript errors from `lib/llm/anthropic.ts`. If you see `Property 'ttl' does not exist`, the SDK version in `node_modules` doesn't match `package.json` — run `npm install` first.

- [ ] **Step 3: Run the full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/llm/anthropic.ts
git commit -m "fix: remove stale as-unknown-as casts — SDK v0.92.0 types ttl natively"
```

---

## Task 4: Add `skills-grid` className and print CSS rule

**Why:** `.skills-row { page-break-inside: avoid; }` was added but `className="skills-grid"` was never added to the outer skills container Box, and the `.skills-grid { display: grid; grid-template-columns: 154px 1fr; }` CSS rule was never added to the `@media print` block. Without it the `width: 154` pixel column collapses in some browser print engines and the label/value misalign.

**Files:**
- Modify: `components/ResumePreview.tsx` (line 168)
- Modify: `app/page.tsx` (line 887, inside `@media print`)

No unit test — this is CSS. Verify by printing to PDF in the browser.

---

- [ ] **Step 1: Add `className="skills-grid"` to the outer skills container in `ResumePreview.tsx`**

Locate line 168 (the `<Box sx={{ mb: 2 }}>` that wraps the entire Core Competencies section):

```typescript
// BEFORE (line 168)
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Core Competencies</Typography>
            {output.resume.skills.map((sg, idx) => (
              <Box key={idx} className="skills-row" sx={{ display: 'flex', gap: 1, mb: 0.4 }}>

// AFTER
          <Box className="skills-grid" sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Core Competencies</Typography>
            {output.resume.skills.map((sg, idx) => (
              <Box key={idx} className="skills-row" sx={{ display: 'flex', gap: 1, mb: 0.4 }}>
```

- [ ] **Step 2: Add `.skills-grid` CSS rule in `app/page.tsx`**

Locate line 887 (inside the `@media print` block). Add the grid rule immediately after the existing `.skills-row` rule:

```typescript
// BEFORE (line 887)
          .skills-row { page-break-inside: avoid; }
        }

// AFTER
          .skills-row { page-break-inside: avoid; }
          .skills-grid { display: grid; grid-template-columns: 154px 1fr; }
        }
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass. ClassNames are transparent to Jest.

- [ ] **Step 4: Commit**

```bash
git add components/ResumePreview.tsx app/page.tsx
git commit -m "fix: add skills-grid className and print CSS rule for two-column layout"
```

---

## Self-Review

**Spec coverage:**

| Finding | Task | Status |
|---|---|---|
| Bug 1: onRetry bypasses isGenerateFlowRef → retry button disappears | Task 1 | ✓ |
| Bug 2: setError(null) race clears isGenerateFlowRef before API starts | Task 1 | ✓ |
| Finding 3: CANDIDATE IS APPLYING TO instruction missing from prompt | Task 2 | ✓ |
| Finding 4: useRef imported but unused in useGenerate.ts | Task 1 (step 3a) | ✓ |
| Finding 5: skills-grid className and CSS missing | Task 4 | ✓ |
| Finding 6: as unknown as casts not removed despite SDK typing ttl | Task 3 | ✓ |

**Placeholder scan:** None found. Every step has exact code.

**Type consistency:**
- `isGenerationError` (boolean) added to hook state → exported in return object → destructured in `page.tsx` — consistent name throughout.
- `setIsGenerationError` is only called inside `handleGenerate` in the hook; no caller outside the hook touches it.
- The 3 error paths inside `handleGenerate` where `setIsGenerationError(true)` is added are the same 3 paths identified in the code review.
- `JD_EXTRACTION_SYSTEM_PROMPT` is already correctly imported in `lib/llm/anthropic.ts` — Task 2 only changes `lib/prompt.ts`.
- After removing casts, the `messagesContent` array still types as `Anthropic.Beta.Messages.BetaContentBlockParam[]` — the per-element objects are structurally compatible with that type (they have `type: 'text'` and `text: string`, which is what `BetaTextBlockParam` requires; `cache_control` with `ttl` is now natively typed in the SDK).
