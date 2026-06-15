# Cost Reduction & Frontend Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut per-resume API cost ~35% by fixing prompt-cache hit rate (6% → 65-80%) and improve frontend UX with retry on error, skeleton loading, and consistent PDF/DOCX formatting.

**Architecture:** Seven targeted, independent changes across four files. All LLM changes are in `lib/llm/anthropic.ts` and `lib/prompt.ts`; frontend changes are in `components/ErrorBanner.tsx`, `app/page.tsx`, `components/ResumePreview.tsx`, and `lib/docxGenerator.ts`. No schema changes, no API contract changes, no hook rewrites.

**Tech Stack:** Next.js 14 App Router, TypeScript, Anthropic SDK (`@anthropic-ai/sdk`), MUI v5, `docx` npm package, Jest/jsdom for tests.

---

## Files touched

| File | What changes |
|---|---|
| `lib/prompt.ts` | Replace `buildJDExtractionPrompt` function with `JD_EXTRACTION_SYSTEM_PROMPT` constant |
| `lib/llm/anthropic.ts` | Import update, 1-hour TTL, remove wrong `cache_control`, fix fallback model, update analyze-jd user message |
| `components/ErrorBanner.tsx` | Add `onRetry?: () => void` prop + "Try Again" button |
| `app/page.tsx` | Pass `onRetry` to ErrorBanner, replace `alert()` with `setError()`, add MUI Skeleton in loading state, add print CSS + Skeleton import |
| `components/ResumePreview.tsx` | Add `className="skills-grid"` / `className="skills-row"` to skills section |
| `lib/docxGenerator.ts` | Import `VerticalAlign`, fix cell margins, add `verticalAlign: VerticalAlign.TOP` to both table cells |
| `__tests__/prompt.test.ts` | Update import + add `JD_EXTRACTION_SYSTEM_PROMPT` tests; remove `buildJDExtractionPrompt` test |

---

## Task 1: Remove wrong `cache_control` from `currentOutput` + fix fallback model

**Files:**
- Modify: `lib/llm/anthropic.ts:208` (remove `cache_control` from currentOutput block)
- Modify: `lib/llm/anthropic.ts:240` (update fallback model string)

The `currentOutput` block in refine mode has `cache_control: { type: 'ephemeral' }` even though this JSON blob changes on every call — a guaranteed cache-write that never produces a read, costing 1.25× for nothing. The fallback model `'claude-3-5-sonnet-20241022'` no longer exists under that ID.

- [ ] **Step 1: Write failing test**

Add to `__tests__/prompt.test.ts` (the existing test file for prompt-related constants — no separate anthropic test file exists, so this is where we document the refine-mode contract):

```typescript
// At the end of __tests__/prompt.test.ts

describe('REFINE_SYSTEM_PROMPT does not embed current output', () => {
  it('does not contain currentOutput placeholder text (cache_control must not be on the JSON blob)', () => {
    // The REFINE_SYSTEM_PROMPT itself is static — this test documents that the
    // current-output JSON block must NOT receive cache_control. We verify the
    // prompt contains no dynamic/output markers that would indicate it was
    // embedded in the system prompt instead of the user message.
    expect(REFINE_SYSTEM_PROMPT).not.toContain('CURRENT RESUME AND COVER LETTER (JSON)');
  });
});
```

Run: `npx jest __tests__/prompt.test.ts -t "does not embed current output" --no-coverage`
Expected: **PASS** (test passes immediately — the static prompt text doesn't contain that string; this test guards against a future regression where someone moves the dynamic block into the system prompt).

- [ ] **Step 2: Apply the fix in `lib/llm/anthropic.ts`**

In `lib/llm/anthropic.ts`, locate line 204-214 (the refine mode `messagesContent` block):

```typescript
// BEFORE — line 204-214
    messagesContent = [
      {
        type: 'text',
        text: `CURRENT RESUME AND COVER LETTER (JSON):\n${JSON.stringify(payload.currentOutput, null, 2)}`,
        cache_control: { type: 'ephemeral' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam
    ];
```

```typescript
// AFTER — remove cache_control from the currentOutput block
    messagesContent = [
      {
        type: 'text',
        text: `CURRENT RESUME AND COVER LETTER (JSON):\n${JSON.stringify(payload.currentOutput, null, 2)}`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam
    ];
```

- [ ] **Step 3: Fix fallback model string in `lib/llm/anthropic.ts`**

Locate line 240 (in the `catch` block of the outer `try`):

```typescript
// BEFORE
          : 'claude-3-5-sonnet-20241022';
```

```typescript
// AFTER
          : 'claude-sonnet-4-6';
```

- [ ] **Step 4: Run the full test suite to verify nothing broke**

Run: `npm test -- --no-coverage`
Expected: all tests pass. No snapshot failures, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/anthropic.ts __tests__/prompt.test.ts
git commit -m "fix: remove cache_control from refine currentOutput block; update fallback model to claude-sonnet-4-6"
```

---

## Task 2: Fix `analyze-jd` system prompt — static constant + move companyName to user message

**Files:**
- Modify: `lib/prompt.ts` (replace function with constant)
- Modify: `lib/llm/anthropic.ts` (update import + analyze-jd branch)
- Modify: `__tests__/prompt.test.ts` (replace old test with new constant test)

**Problem:** `buildJDExtractionPrompt` embeds `companyName` in the system prompt string. Each unique company creates a different cache key, so the analyze-jd cache never hits across calls for different companies. The fix: move the system prompt to a static constant; `companyName` (and the JD itself) go only in the user message.

Note: the `jd` parameter in the old function was dead code — the JD already arrived in the user message separately (line 170 of the current `anthropic.ts`). This fix cleans that up too.

- [ ] **Step 1: Write a failing test for the new constant**

Add to `__tests__/prompt.test.ts`:

```typescript
import {
  SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
  JD_EXTRACTION_SYSTEM_PROMPT,  // add this import
} from '../lib/prompt';
```

(Update the existing import at the top of the file from the two-item import to a three-item import.)

Then add at the end of `__tests__/prompt.test.ts`:

```typescript
describe('JD_EXTRACTION_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof JD_EXTRACTION_SYSTEM_PROMPT).toBe('string');
    expect(JD_EXTRACTION_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });

  it('contains no dynamic company name placeholder', () => {
    expect(JD_EXTRACTION_SYSTEM_PROMPT).not.toContain('applying to the company');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).not.toContain('companyName');
  });

  it('instructs the model to return the required JSON fields', () => {
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('seniority');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('mustHaveSkills');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('niceToHaveSkills');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('gapsDetected');
  });

  it('does not expose the buildJDExtractionPrompt function', () => {
    // The old function is removed; only the constant export exists.
    // This test will fail until lib/prompt.ts is updated.
    const mod = require('../lib/prompt');
    expect(typeof mod.JD_EXTRACTION_SYSTEM_PROMPT).toBe('string');
    expect(mod.buildJDExtractionPrompt).toBeUndefined();
  });
});
```

Run: `npx jest __tests__/prompt.test.ts -t "JD_EXTRACTION_SYSTEM_PROMPT" --no-coverage`
Expected: **FAIL** — `JD_EXTRACTION_SYSTEM_PROMPT` not found in `lib/prompt`.

- [ ] **Step 2: Replace `buildJDExtractionPrompt` in `lib/prompt.ts`**

In `lib/prompt.ts`, replace lines 195-209 (the entire `buildJDExtractionPrompt` function):

```typescript
// BEFORE
export function buildJDExtractionPrompt(jd: string, companyName?: string): string {
  return `You are an expert ATS parser and technical recruiter. Your task is to analyze the job description and extract structural keywords.
${companyName ? `The candidate is applying to the company: "${companyName}".` : ''}

Output a single JSON object matching the following structure. Do NOT include markdown blocks or any text other than the JSON:
{
  "seniority": "string (e.g. 'Senior', 'Entry', 'Mid')",
  "companyName": "string or null (the company offering this role)",
  "mustHaveSkills": ["string", "string", ...],
  "niceToHaveSkills": ["string", "string", ...],
  "gapsDetected": ["string", "string", ...]
}

Return ONLY this JSON representation. Do not explain your choices. Ensure all keys are populated.`;
}
```

```typescript
// AFTER
export const JD_EXTRACTION_SYSTEM_PROMPT = `You are an expert ATS parser and technical recruiter. Your task is to analyze the job description and extract structural keywords.

Output a single JSON object matching the following structure. Do NOT include markdown blocks or any text other than the JSON:
{
  "seniority": "string (e.g. 'Senior', 'Entry', 'Mid')",
  "companyName": "string or null (the company offering this role)",
  "mustHaveSkills": ["string", "string", ...],
  "niceToHaveSkills": ["string", "string", ...],
  "gapsDetected": ["string", "string", ...]
}

Return ONLY this JSON representation. Do not explain your choices. Ensure all keys are populated.`;
```

- [ ] **Step 3: Update import and analyze-jd branch in `lib/llm/anthropic.ts`**

**Line 2 — update import:**

```typescript
// BEFORE
import { SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT, buildJDExtractionPrompt } from '@/lib/prompt';
```

```typescript
// AFTER
import { SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT, JD_EXTRACTION_SYSTEM_PROMPT } from '@/lib/prompt';
```

**Lines 162-172 — update analyze-jd branch:**

```typescript
// BEFORE
  if (mode === 'analyze-jd') {
    if (!payload.jobDescription) {
      throw new Error('Job Description is required for analyze-jd mode');
    }
    systemPrompt = buildJDExtractionPrompt(payload.jobDescription, payload.companyName);
    messagesContent = [
      {
        type: 'text',
        text: `Please analyze the job description and extract the keywords, seniority, and company name as JSON: ${payload.jobDescription}`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
    ];
  }
```

```typescript
// AFTER
  if (mode === 'analyze-jd') {
    if (!payload.jobDescription) {
      throw new Error('Job Description is required for analyze-jd mode');
    }
    systemPrompt = JD_EXTRACTION_SYSTEM_PROMPT;
    messagesContent = [
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}${payload.companyName ? `\n\nCANDIDATE IS APPLYING TO: ${payload.companyName}` : ''}`,
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
    ];
  }
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/prompt.test.ts --no-coverage`
Expected: all tests in the file pass, including the new `JD_EXTRACTION_SYSTEM_PROMPT` suite.

Run: `npm test -- --no-coverage`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/prompt.ts lib/llm/anthropic.ts __tests__/prompt.test.ts
git commit -m "feat: replace buildJDExtractionPrompt with static JD_EXTRACTION_SYSTEM_PROMPT to fix analyze-jd cache hit rate"
```

---

## Task 3: Switch all static cache blocks to 1-hour TTL

**Files:**
- Modify: `lib/llm/anthropic.ts` (lines 182, 218)

The current `cache_control: { type: 'ephemeral' }` uses the default 5-minute TTL. The user's workflow (paste resume → generate → apply → repeat with new JD) takes 10-20 minutes per application. 5-minute cache expires between every call. With 1-hour TTL, jobs 2-5 in a session hit the cache for both the system prompt and the resume block (which never changes within a session).

The correct syntax is `{ type: 'ephemeral', ttl: '1h' }`. No new beta header is needed — `prompt-caching-2024-07-31` already covers both TTLs.

Two blocks need updating:
1. **Resume user-message block** (line 182, generate mode): `cache_control: { type: 'ephemeral' }`
2. **System prompt block** (line 218): `cache_control: { type: 'ephemeral' }`

The analyze-jd system block is built from the same `systemBlocks` array at line 217-219 — so fixing line 218 covers all three modes.

- [ ] **Step 1: Update the resume block (generate mode) in `lib/llm/anthropic.ts`**

Locate line 182 in the generate branch:

```typescript
// BEFORE
      {
        type: 'text',
        text: `CANDIDATE RESUME:\n${payload.resume}`,
        cache_control: { type: 'ephemeral' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
```

```typescript
// AFTER
      {
        type: 'text',
        text: `CANDIDATE RESUME:\n${payload.resume}`,
        cache_control: { type: 'ephemeral', ttl: '1h' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
```

- [ ] **Step 2: Update the system prompt block in `lib/llm/anthropic.ts`**

Locate line 218 (the `systemBlocks` constant):

```typescript
// BEFORE
  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } } as unknown as Anthropic.Beta.Messages.BetaTextBlockParam
  ];
```

```typescript
// AFTER
  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } } as unknown as Anthropic.Beta.Messages.BetaTextBlockParam
  ];
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --no-coverage`
Expected: all tests pass. (The TTL field is passed through the `as unknown as` cast so TypeScript won't reject it; the SDK forwards it to the API as-is.)

- [ ] **Step 4: Commit**

```bash
git add lib/llm/anthropic.ts
git commit -m "perf: upgrade prompt cache to 1-hour TTL for system prompt and resume blocks"
```

---

## Task 4: ErrorBanner retry button + replace `alert()` with `setError()`

**Files:**
- Modify: `components/ErrorBanner.tsx`
- Modify: `app/page.tsx` (line 326, line 655)

When generation fails, users currently see the error banner and must scroll to the Generate button to retry. Adding a "Try Again" button to the banner makes recovery one click. Separately, download errors call `alert()` — a jarring browser modal — instead of the in-app error UI.

- [ ] **Step 1: Write a failing test for the retry button**

No component test file exists for `ErrorBanner`. We'll add one:

Create `__tests__/ErrorBanner.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBanner from '../components/ErrorBanner';
import { ApiErrorResponse } from '../types/error';

const fatalError: ApiErrorResponse = {
  error: {
    type: 'FATAL',
    message: 'Something went wrong',
  },
};

const rateLimitError: ApiErrorResponse = {
  error: {
    type: 'RATE_LIMIT',
    message: 'Too many requests',
    retryAfterSeconds: 10,
  },
};

describe('ErrorBanner', () => {
  it('renders null when error is null', () => {
    const { container } = render(
      <ErrorBanner error={null} onDismiss={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders error message', () => {
    render(<ErrorBanner error={fatalError} onDismiss={jest.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = jest.fn();
    render(<ErrorBanner error={fatalError} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders Try Again button when onRetry is provided', () => {
    render(
      <ErrorBanner error={fatalError} onDismiss={jest.fn()} onRetry={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls onRetry when Try Again is clicked', () => {
    const onRetry = jest.fn();
    render(
      <ErrorBanner error={fatalError} onDismiss={jest.fn()} onRetry={onRetry} />
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does NOT render Try Again button when onRetry is not provided', () => {
    render(<ErrorBanner error={fatalError} onDismiss={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('shows countdown for rate-limit errors', () => {
    render(<ErrorBanner error={rateLimitError} onDismiss={jest.fn()} />);
    expect(screen.getByText(/retry available in/i)).toBeInTheDocument();
  });
});
```

Run: `npx jest __tests__/ErrorBanner.test.tsx --no-coverage`
Expected: **FAIL** — "Try Again" button tests fail because the prop doesn't exist yet.

- [ ] **Step 2: Add `onRetry` prop and "Try Again" button to `ErrorBanner.tsx`**

Replace the full content of `components/ErrorBanner.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ApiErrorResponse } from '@/types/error';

interface ErrorBannerProps {
  error: ApiErrorResponse | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

const TYPE_LABELS: Record<ApiErrorResponse['error']['type'], string> = {
  RATE_LIMIT: '⏳ Rate Limited',
  TIMEOUT: '⏱ Timeout / Overloaded',
  TOKEN_LIMIT: '📏 Input Too Long',
  VALIDATION_FAILED: '⚠️ Validation Error',
  FATAL: '❌ Error',
};

export default function ErrorBanner({ error, onDismiss, onRetry }: ErrorBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (error?.error.type === 'RATE_LIMIT' && error.error.retryAfterSeconds) {
      setSecondsLeft(error.error.retryAfterSeconds);
    } else {
      setSecondsLeft(null);
    }
  }, [error]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  if (!error) return null;

  const isRateLimit = error.error.type === 'RATE_LIMIT';
  const severity = isRateLimit ? 'warning' : 'error';
  const label = TYPE_LABELS[error.error.type] ?? '❌ Error';

  return (
    <Alert
      severity={severity}
      onClose={onDismiss}
      sx={{ mb: 3 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="body2">
          {error.error.message}
        </Typography>
        {isRateLimit && secondsLeft !== null && (
          <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.85, mt: 0.5 }}>
            {secondsLeft > 0
              ? `Retry available in ${secondsLeft}s`
              : '✅ Ready to retry'}
          </Typography>
        )}
        {onRetry && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={onRetry}
              sx={{ textTransform: 'none' }}
            >
              Try Again
            </Button>
          </Box>
        )}
      </Box>
    </Alert>
  );
}
```

- [ ] **Step 3: Run the ErrorBanner tests**

Run: `npx jest __tests__/ErrorBanner.test.tsx --no-coverage`
Expected: **PASS** — all 7 tests pass.

- [ ] **Step 4: Wire up `onRetry` and fix `alert()` in `app/page.tsx`**

**4a — Pass `handleGenerate` as `onRetry` to ErrorBanner (line 654-656):**

```typescript
// BEFORE (line 654-656)
            {error && !isLoading && (
              <ErrorBanner error={error} onDismiss={clearError} />
            )}
```

```typescript
// AFTER
            {error && !isLoading && (
              <ErrorBanner error={error} onDismiss={clearError} onRetry={() => handleGenerate(anthropicKey)} />
            )}
```

**4b — Replace `alert()` in `handleDownload` (line 326):**

```typescript
// BEFORE (line 326)
      alert(`Download failed: ${err}`);
```

```typescript
// AFTER
      setError({ error: { type: 'FATAL', message: `Download failed: ${err instanceof Error ? err.message : String(err)}` } });
```

- [ ] **Step 5: Verify `setError` is available in scope**

Check that `setError` is destructured from `useGenerate`. Run:

```bash
grep -n "setError" /Users/sb/Documents/Projects/GitHub/resume-builder/app/page.tsx | head -10
```

Expected output includes `setError` in the destructuring block from `useGenerate`. If it isn't there, check `hooks/useGenerate.ts` for the correct exported name and use that.

- [ ] **Step 6: Run all tests**

Run: `npm test -- --no-coverage`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/ErrorBanner.tsx app/page.tsx __tests__/ErrorBanner.test.tsx
git commit -m "feat: add retry button to ErrorBanner; replace alert() with setError() in download handler"
```

---

## Task 5: Add skeleton loading state for results area

**Files:**
- Modify: `app/page.tsx` (loading block at lines 643-650, imports at top)

During generation (`isLoading && !output`), the right panel shows only a spinner and text. We'll replace this with a skeleton that outlines the resume shape — header, summary, skills rows, experience entries. When generation completes the skeleton unmounts and real content renders. MUI `Skeleton` is already an available package via `@mui/material`.

- [ ] **Step 1: Add `Skeleton` to imports in `app/page.tsx`**

The existing import block imports individual MUI components. Add `Skeleton`:

```typescript
// Find this line near the top of page.tsx:
import CircularProgress from '@mui/material/CircularProgress';

// Add after it:
import Skeleton from '@mui/material/Skeleton';
```

- [ ] **Step 2: Replace the loading block (lines 643-650)**

```typescript
// BEFORE (lines 643-650)
            {/* Loading */}
            {isLoading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 3 }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #6c63ff, #a855f7)', animation: 'pulse 1.5s ease-in-out infinite', boxShadow: '0 0 40px rgba(108,99,255,0.4)' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Optimizing your profile…</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Analyzing JD · Weaving evidence-backed keywords · Writing cover letter
                </Typography>
              </Box>
            )}
```

```typescript
            {/* Loading */}
            {isLoading && (
              <Box sx={{ p: 3 }}>
                {/* Header skeleton */}
                <Skeleton variant="text" width="60%" height={32} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width="40%" height={20} sx={{ mb: 3 }} />
                {/* Summary skeleton */}
                <Skeleton variant="text" width="30%" height={18} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" width="100%" height={60} sx={{ mb: 3, borderRadius: 1 }} />
                {/* Skills rows skeleton */}
                <Skeleton variant="text" width="30%" height={18} sx={{ mb: 1 }} />
                {[1, 2, 3, 4].map((i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 2, mb: 0.75 }}>
                    <Skeleton variant="text" width={140} height={16} />
                    <Skeleton variant="text" width="70%" height={16} />
                  </Box>
                ))}
                {/* Experience skeleton */}
                <Skeleton variant="text" width="30%" height={18} sx={{ mt: 2, mb: 1 }} />
                {[1, 2].map((i) => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Skeleton variant="text" width="45%" height={16} />
                      <Skeleton variant="text" width="20%" height={16} />
                    </Box>
                    {[1, 2, 3].map((j) => (
                      <Skeleton key={j} variant="text" width={`${85 - j * 5}%`} height={14} sx={{ mb: 0.4 }} />
                    ))}
                  </Box>
                ))}
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 2 }}>
                  Analyzing JD · Weaving evidence-backed keywords · Writing cover letter…
                </Typography>
              </Box>
            )}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --no-coverage`
Expected: all tests pass. (`page.test.tsx` uses jsdom but renders a minimal page — Skeleton is a simple MUI component and won't break it.)

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: replace spinner with resume-shaped skeleton during generation loading state"
```

---

## Task 6: PDF print CSS fixes

**Files:**
- Modify: `components/ResumePreview.tsx` (skills Box at lines 168 and 171)
- Modify: `app/page.tsx` (`@media print` block at lines 805-843)

**Problem:** Skills rows can split across print pages (label on page N, values on page N+1). The `width: 154` pixel value on the category label can collapse in some browser print engines that don't honour pixel widths.

**Fix:** Mark the two skills Box elements with class names so `@media print` CSS can target them with `page-break-inside: avoid` and a two-column grid layout.

- [ ] **Step 1: Add classNames to skills section in `ResumePreview.tsx`**

Locate the skills section at lines 168-188. Make two changes:

**Outer Box (line 168) — add `className="skills-grid"`:**

```typescript
// BEFORE (line 168)
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Core Competencies</Typography>
            {output.resume.skills.map((sg, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.4 }}>
```

```typescript
// AFTER
          <Box className="skills-grid" sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Core Competencies</Typography>
            {output.resume.skills.map((sg, idx) => (
              <Box key={idx} className="skills-row" sx={{ display: 'flex', gap: 1, mb: 0.4 }}>
```

- [ ] **Step 2: Add print CSS rules to `@media print` block in `app/page.tsx`**

The `@media print` block lives in the `<style dangerouslySetInnerHTML>` tag at lines 805-843. Add two new rules inside the `@media print { }` block, after the existing `.editable-field::after` rule (before the closing `}`):

```css
/* AFTER the .editable-field::after { display: none !important; } rule, add: */
          .skills-row { page-break-inside: avoid; }
          .skills-grid { display: grid; grid-template-columns: 154px 1fr; }
```

The full print CSS block should end with:

```css
          .editable-field::after {
            display: none !important;
          }
          .editable-field-container--editing input,
          .editable-field-container--editing textarea {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .skills-row { page-break-inside: avoid; }
          .skills-grid { display: grid; grid-template-columns: 154px 1fr; }
        }
```

- [ ] **Step 3: Run tests**

Run: `npm test -- --no-coverage`
Expected: all tests pass. The classNames are transparent to Jest/jsdom tests.

- [ ] **Step 4: Commit**

```bash
git add components/ResumePreview.tsx app/page.tsx
git commit -m "fix: add skills-row/skills-grid classNames and print CSS to prevent skills splitting across PDF pages"
```

---

## Task 7: DOCX skills table — fix cell margins and vertical alignment

**Files:**
- Modify: `lib/docxGenerator.ts` (import line 1-14; TableCell cells at lines 201-226 and 227-248)

**Problem:** Both table cells have `left: 0` margin — content butts against the column boundary with no internal padding. `verticalAlign` is unset, which in the `docx` library defaults to center — so short category labels (e.g., "Languages") center-align vertically against taller skill-item cells.

**Fix:** Add 8pt (113 DXA) left margin to the label cell, consistent 8pt top/bottom margins to both cells, and explicit `verticalAlign: VerticalAlign.TOP` to both cells.

- [ ] **Step 1: Add `VerticalAlign` to the `docx` import in `lib/docxGenerator.ts`**

```typescript
// BEFORE (lines 1-14)
import { ResumeData } from '@/types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
```

```typescript
// AFTER — add VerticalAlign
import { ResumeData } from '@/types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
} from 'docx';
```

- [ ] **Step 2: Fix label cell margins and add `verticalAlign` (lines 201-226)**

```typescript
// BEFORE — label cell (lines 201-226)
          new TableCell({
            width: {
              size: 2304, // 1.6 inches
              type: WidthType.DXA,
            },
            margins: { top: 30, bottom: 30, left: 0, right: 100 },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: `${group.category}:`,
                    font: 'Times New Roman',
                    size: 22,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
```

```typescript
// AFTER — label cell
          new TableCell({
            width: {
              size: 2304, // 1.6 inches
              type: WidthType.DXA,
            },
            margins: { top: 40, bottom: 40, left: 113, right: 113 },
            verticalAlign: VerticalAlign.TOP,
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: `${group.category}:`,
                    font: 'Times New Roman',
                    size: 22,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
```

- [ ] **Step 3: Fix value cell margins and add `verticalAlign` (lines 227-248)**

```typescript
// BEFORE — value cell (lines 227-248)
          new TableCell({
            width: {
              size: 7056, // 4.9 inches
              type: WidthType.DXA,
            },
            margins: { top: 30, bottom: 30, left: 0, right: 0 },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({
                alignment: JUSTIFY,
                spacing: { before: 0, after: 0 },
                children: buildTextRunsWithBolding(group.items.join(', '), keywords, {
                  font: 'Times New Roman',
                  size: 22,
                }),
              }),
            ],
          }),
```

```typescript
// AFTER — value cell
          new TableCell({
            width: {
              size: 7056, // 4.9 inches
              type: WidthType.DXA,
            },
            margins: { top: 40, bottom: 40, left: 113, right: 0 },
            verticalAlign: VerticalAlign.TOP,
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({
                alignment: JUSTIFY,
                spacing: { before: 0, after: 0 },
                children: buildTextRunsWithBolding(group.items.join(', '), keywords, {
                  font: 'Times New Roman',
                  size: 22,
                }),
              }),
            ],
          }),
```

- [ ] **Step 4: Run DOCX tests**

Run: `npx jest __tests__/docx.test.ts --no-coverage`
Expected: all existing DOCX tests pass. These tests check that the output is a valid zip blob (correct PK magic bytes, size > 0) — they pass regardless of internal margin values.

Run: `npm test -- --no-coverage`
Expected: full suite passes.

- [ ] **Step 5: Commit**

```bash
git add lib/docxGenerator.ts
git commit -m "fix: add 8pt left margin and VerticalAlign.TOP to DOCX skills table cells"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Remove `cache_control` from `currentOutput` in refine | Task 1 |
| Update fallback model to `claude-sonnet-4-6` | Task 1 |
| Replace `buildJDExtractionPrompt` with static constant | Task 2 |
| Move `companyName` to user message in analyze-jd | Task 2 |
| 1-hour TTL on system prompt block | Task 3 |
| 1-hour TTL on resume user-message block | Task 3 |
| ErrorBanner `onRetry` prop + "Try Again" button | Task 4 |
| Replace `alert()` in download handler with `setError()` | Task 4 |
| Skeleton loading state in results panel | Task 5 |
| `className="skills-grid"` / `"skills-row"` in ResumePreview | Task 6 |
| `@media print` `page-break-inside: avoid` + grid CSS | Task 6 |
| DOCX label cell margins `{ top: 40, bottom: 40, left: 113, right: 113 }` | Task 7 |
| DOCX value cell margins `{ top: 40, bottom: 40, left: 113, right: 0 }` | Task 7 |
| `VerticalAlign.TOP` on both DOCX cells | Task 7 |

All spec requirements covered. No gaps.

**Placeholder scan:** None found.

**Type consistency:**
- `JD_EXTRACTION_SYSTEM_PROMPT` (string constant) used consistently in both `lib/prompt.ts` and `lib/llm/anthropic.ts` import.
- `onRetry?: () => void` in `ErrorBannerProps` matches the call site `() => handleGenerate(anthropicKey)` — both `() => void`.
- `VerticalAlign` imported from `docx` package and used as `VerticalAlign.TOP` — matches the docx API.
- `setError` — Task 4 step 5 includes a verification grep to confirm the name from `useGenerate` before using it.
