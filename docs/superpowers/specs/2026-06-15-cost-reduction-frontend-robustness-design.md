# Cost Reduction & Frontend Robustness Design

**Date:** 2026-06-15
**Status:** Approved for implementation

## Background

Current cost is ~$0.12 per resume. The June 2026 API usage audit identified a cache hit rate of only 6% — the app writes large volumes to the 5-minute prompt cache but reads back almost none of it because users take longer than 5 minutes between actions. The user's typical workflow (LinkedIn → paste JD → generate → apply → repeat with new JD, several times per session) means sessions of 3–5 generates/hour with the same resume. This is exactly the pattern that 1-hour caching was designed for.

Separately, the frontend has four known pain points: no error retry path, no loading skeleton during generation, and inconsistent formatting in both the browser PDF print output and the DOCX download.

---

## Section 1: LLM Pipeline & Caching

### Files changed
- `lib/llm/anthropic.ts`
- `lib/prompt.ts`

### Change 1: 1-hour TTL for all static blocks

Add the extended TTL beta to the `betas` array (exact string to verify against Anthropic API docs during implementation — likely `extended-cache-ttl-2025-02-19`). Add `ttl: 3600` to every `cache_control` block on static content:

| Block | Mode | Change |
|---|---|---|
| `SYSTEM_PROMPT` system block | generate | `{ type: 'ephemeral', ttl: 3600 }` |
| `REFINE_SYSTEM_PROMPT` system block | refine | `{ type: 'ephemeral', ttl: 3600 }` |
| `JD_EXTRACTION_SYSTEM_PROMPT` system block | analyze-jd | `{ type: 'ephemeral', ttl: 3600 }` |
| Resume text user message block | generate | `{ type: 'ephemeral', ttl: 3600 }` |

The resume block benefits most from this change: the user sends the same resume for every job application in a session, so jobs 2–5 all read the resume + system prompt from cache at $0.30/MTok instead of $3/MTok.

### Change 2: Remove `cache_control` from `currentOutput` in refine mode

The `currentOutput` block (the full generated resume+cover letter JSON) is tagged with `cache_control: ephemeral` but changes on every single call. This causes a cache write at 1.25× cost that never produces a read. Remove the `cache_control` entirely — treat it as regular uncached input.

```typescript
// Before
{ type: 'text', text: `CURRENT RESUME...\n${JSON.stringify(currentOutput)}`, cache_control: { type: 'ephemeral' } }

// After
{ type: 'text', text: `CURRENT RESUME...\n${JSON.stringify(currentOutput)}` }
```

### Change 3: Fix `analyze-jd` system prompt — make it fully static

**Problem:** `buildJDExtractionPrompt` embeds `companyName` inside the system prompt string. Every unique company name creates a different cache key, so the cache never hits.

**Note:** The `jd` parameter in the original function signature is never used in the function body — the JD already arrives in the user message separately. The function only embedded `companyName` into the system string. The fix doesn't change what Claude receives about the JD.

**Fix:** Replace the function with a named constant `JD_EXTRACTION_SYSTEM_PROMPT` containing only static instructions. Move `companyName` to the user message alongside the JD.

```typescript
// lib/prompt.ts — BEFORE (function, embeds companyName in system prompt)
export function buildJDExtractionPrompt(jd: string, companyName?: string): string {
  return `You are an expert ATS parser...
${companyName ? `The candidate is applying to the company: "${companyName}".` : ''}
...`;
}

// lib/prompt.ts — AFTER (static constant, no dynamic content)
export const JD_EXTRACTION_SYSTEM_PROMPT = `You are an expert ATS parser and technical recruiter.
Your task is to analyze the job description and extract structural keywords.
Output a single JSON object...
Return ONLY this JSON representation.`;
```

```typescript
// lib/llm/anthropic.ts — analyze-jd user message AFTER
text: `JOB DESCRIPTION:\n${payload.jobDescription}${payload.companyName ? `\n\nCANDIDATE IS APPLYING TO: ${payload.companyName}` : ''}`
```

Claude can still see and extract the company name from the user message — it just no longer lives in the cached prefix.

### Change 4: Update model fallback string

Change the hardcoded fallback in the unsupported-model error handler:

```typescript
// Before
'claude-3-5-sonnet-20241022'

// After
'claude-sonnet-4-6'
```

### What is NOT changing

- `SYSTEM_PROMPT` content — well-structured, every section earns its tokens
- `REFINE_SYSTEM_PROMPT` content — efficient, `<output_format>` references the schema without repeating it
- Model selection UI — Sonnet 4.5 stays available (used for testing)
- `max_tokens: 8192` — output token cost is fixed by response size, not the limit

### Expected impact (estimates)

| Scenario | Before | After |
|---|---|---|
| Session of 1 resume | ~$0.12 | ~$0.12 (no change) |
| Session of 3 resumes | ~$0.36 | ~$0.28 (cache hits on jobs 2–3) |
| Session of 5 resumes | ~$0.60 | ~$0.40 (cache hits on jobs 2–5) |
| Refine call | +$0.08 (wasted currentOutput write) | +$0.06 (no wasted write) |

Figures assume same resume across all jobs in session, Sonnet 4.6 pricing. Actual savings scale with session length.

---

## Section 2: Frontend Robustness

### Files changed
- `app/page.tsx`
- `components/ErrorBanner.tsx`

### Change 1: Retry button in error state

`ErrorBanner` currently shows the error message and a dismiss button. There is no way to retry without scrolling back to the Generate button manually.

Add an `onRetry?: () => void` prop to `ErrorBanner`. When provided, render a "Try Again" button alongside "Dismiss". In `app/page.tsx`, pass `handleGenerate` as `onRetry` to the error banner instance at line 654.

### Change 2: Loading skeleton for results area

During generation (`isLoading && !output`), the results area is empty. Add a skeleton placeholder that shows the outline of a resume — header block, summary block, skills rows, experience entries — using MUI `Skeleton` components (already in the dependency tree). When generation completes, the skeleton unmounts and real content renders. No layout shift.

The skeleton renders in the same area as the output (line 643 block in `page.tsx`), replacing the current empty state.

### Change 3: Replace `alert()` with ErrorBanner

In the download handler (`handleDownload`, around line 325 in `page.tsx`), failures currently call `alert()`. Replace with a call to `setError()` so failures surface in the existing `ErrorBanner` at the top of the results area.

---

## Section 3: PDF & DOCX Formatting

### PDF — `app/page.tsx` (`@media print` block)

**Problem:** Skills rows can split across print pages (label on one page, items on the next). The `width: 154` pixel value on the category label can collapse in some browser print engines.

**Fix:** Add two rules inside the existing `@media print` block:

```css
/* Prevent skills row splitting across pages */
.skills-row { page-break-inside: avoid; }

/* Reliable two-column layout for print */
.skills-grid { display: grid; grid-template-columns: 154px 1fr; }
```

Add `className="skills-row"` to each skill group `Box` and `className="skills-grid"` to the outer skills container in `ResumePreview.tsx` (line 171). Screen rendering is unchanged — only print uses the grid.

### DOCX — `lib/docxGenerator.ts` (lines 200–252)

**Problem:** Both table cells have `left: 0` margin — content butts against column boundaries with no internal padding. `verticalAlign` is unset, so short labels center-align against taller rows.

**Fix:** Update both cells:

```typescript
// Label cell — before
margins: { top: 30, bottom: 30, left: 0, right: 100 }

// Label cell — after
margins: { top: 40, bottom: 40, left: 113, right: 113 }

// Value cell — before
margins: { top: 30, bottom: 30, left: 0, right: 0 }

// Value cell — after
margins: { top: 40, bottom: 40, left: 113, right: 0 }
```

Add `verticalAlign: VerticalAlign.TOP` to both cells. `113` DXA = 8pt, consistent with the rest of the document's internal spacing.

---

## Out of Scope

- Streaming LLM responses (Server-Sent Events rewrite — separate project)
- `SYSTEM_PROMPT` content changes
- Model selection UI changes
- Output token reduction (would require quality trade-offs)
