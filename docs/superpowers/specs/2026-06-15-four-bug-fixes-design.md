# Design: Four Bug Fixes — Generation Error Tracking, Cache TTL Casts, JD Extraction Hint

**Date:** 2026-06-15
**Scope:** `hooks/useGenerate.ts`, `app/page.tsx`, `lib/llm/anthropic.ts`, `lib/prompt.ts`

---

## Bug 1 + 2: `isGenerationError` Tracking (Architectural Fix)

### Problem

Two related bugs share the same root cause: `isGenerationError` is tracked in `page.tsx` via a `useRef` + `useEffect` state machine that races with React's render cycle.

**Bug 1 — retry button disappears after first retry:**
`handleGenerateClick` sets `isGenerateFlowRef.current = true` before calling `handleGenerate`, but `ErrorBanner`'s `onRetry` calls `handleGenerate` directly, never setting the ref. After the first retry fails, the ref is `false`, so `isGenerationError` is never set to `true`, and the retry button is permanently hidden.

**Bug 2 — retry button disappears when a prior error exists:**
`handleGenerate` calls `setError(null)` synchronously before `await computeHash(...)`. This intermediate render triggers the `useEffect` on `[isLoading, error]`, which sees `!error` and sets `isGenerateFlowRef.current = false`. When the API eventually fails, the ref is already cleared, so `isGenerationError` is never set.

### Fix

Move `isGenerationError` state into `useGenerate.ts`. The hook owns all generation state; this tracking belongs there.

**`hooks/useGenerate.ts` changes:**

```typescript
// Add state
const [isGenerationError, setIsGenerationError] = useState(false);

// At the start of handleGenerate (before setError(null)):
setIsGenerationError(false);

// In every catch block that calls setError with a non-null error:
setIsGenerationError(true);

// Expose in hook return value:
return { ..., isGenerationError, ... };
```

The three error paths in `handleGenerate` that need `setIsGenerationError(true)`:
1. `if (!jdJson.success) { setError(jdJson); return; }` — JD analysis API call failed (line ~241)
2. `if (!json.success) { setError(json); return; }` — main generate API call failed (line ~267)
3. The `catch (e)` block at line ~276 — network error or unexpected throw

`handleRefine` and `handleRefreshRecommendations` also call `setError` but are not generation flows — they must NOT set `isGenerationError`.

**`app/page.tsx` removals:**

- Delete `const [isGenerationError, setIsGenerationError] = useState(false);`
- Delete `const prevIsLoadingRef = useRef(false);`
- Delete `const isGenerateFlowRef = useRef(false);`
- Delete the `useEffect(() => { ... }, [isLoading, error])` block that watches `[isLoading, error]`
- Delete `isGenerateFlowRef.current = true;` from `handleGenerateClick`
- Destructure `isGenerationError` from `useGenerate` return value instead

The `onRetry` wiring in `ErrorBanner` needs no change — `() => handleGenerate(anthropicKey)` is already correct, because the hook now sets the flag itself at the start of each `handleGenerate` call.

---

## Bug 3: Remove Stale `as unknown as` Casts in `anthropic.ts`

### Problem

`cache_control: { type: 'ephemeral', ttl: '1h' }` blocks in `lib/llm/anthropic.ts` are cast with `as unknown as Anthropic.Beta.Messages.BetaContentBlockParam` / `BetaTextBlockParam` to bypass TypeScript. This was necessary when the SDK didn't include the `ttl` field in its types.

**SDK v0.92.0 (currently installed) now types `ttl` correctly:**
```typescript
// node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts
ttl?: '5m' | '1h';
```

The casts now mask real type errors and make the code brittle. They should be removed.

**No beta header change needed.** The claude-api skill confirms `prompt-caching-2024-07-31` is the correct and only required beta header for both 5-minute and 1-hour TTLs. No separate `extended-cache-ttl-*` header exists.

### Fix

Remove all `as unknown as Anthropic.Beta.Messages.BetaContentBlockParam` and `as unknown as Anthropic.Beta.Messages.BetaTextBlockParam` casts. The types now work natively.

Affected locations in `lib/llm/anthropic.ts`:
- Line 171: `analyze-jd` user message block (no `cache_control` — cast can just be removed)
- Line 183: `generate` mode resume block with `cache_control: { type: 'ephemeral', ttl: '1h' }`
- Line 187: `generate` mode JD block (no `cache_control` — cast can just be removed)
- Line 194: `generate` mode jdKeywords block (no `cache_control` — cast can just be removed)
- Line 206: `refine` mode currentOutput block (no `cache_control` — cast can just be removed)
- Line 211: `refine` mode recList block (no `cache_control` — cast can just be removed)
- Line 217: system block with `cache_control: { type: 'ephemeral', ttl: '1h' }`

After removing the casts, TypeScript will validate the `cache_control` shape natively. The `ttl: '1h'` values remain — they're correct per the API spec and now properly typed.

---

## Bug 4: JD Extraction Prompt — Company Name from User Hint

### Problem

`JD_EXTRACTION_SYSTEM_PROMPT` instructs Claude to extract `companyName` from the job description text. When the JD is posted by a recruiter (blind posting without company name), Claude returns `null`.

The user message already includes a `CANDIDATE IS APPLYING TO: <company>` line when the user filled in the company field (`app/page.tsx` passes `payload.companyName` to `callAnthropic`). However, the system prompt never tells Claude to use this hint, so it is ignored.

### Fix

Add one sentence to `JD_EXTRACTION_SYSTEM_PROMPT` in `lib/prompt.ts` immediately before the output schema definition:

```
If the user message contains a line starting with "CANDIDATE IS APPLYING TO:", use that value as the companyName — this is especially important when the job description itself does not name the hiring company (e.g., posted by a recruiter on behalf of an unnamed client).
```

The full updated prompt becomes:

```typescript
export const JD_EXTRACTION_SYSTEM_PROMPT = `You are an expert ATS parser and technical recruiter. Your task is to analyze the job description and extract structural keywords.

If the user message contains a line starting with "CANDIDATE IS APPLYING TO:", use that value as the companyName — this is especially important when the job description itself does not name the hiring company (e.g., posted by a recruiter on behalf of an unnamed client).

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

---

## Files Changed

| File | Change |
|---|---|
| `hooks/useGenerate.ts` | Add `isGenerationError` state; set `false` at start, `true` in catch blocks; export |
| `app/page.tsx` | Remove `isGenerationError` state, `prevIsLoadingRef`, `isGenerateFlowRef`, tracking `useEffect`; destructure from hook |
| `lib/llm/anthropic.ts` | Remove all 7 `as unknown as` casts |
| `lib/prompt.ts` | Add one sentence to `JD_EXTRACTION_SYSTEM_PROMPT` |

## Testing

- **Bugs 1 & 2:** Trigger a generation failure. Confirm retry button appears. Click retry. Confirm retry button still appears on second failure. Also test: start generate while an existing error is showing — confirm retry button appears after the new failure.
- **Bug 3:** TypeScript compiler (`npm run build`) will confirm the casts are no longer needed. No runtime behavior change (the `ttl` field was already passing through JSON serialization correctly).
- **Bug 4:** Use a blind JD (no company name in JD text) + fill in company name field. Confirm `extractedCompanyName` in the response matches the entered company name.
