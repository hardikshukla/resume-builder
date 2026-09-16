/**
 * generationCache.ts — browser-side cache of generation results, so repeating
 * a generation (same resume, JD, company and model) costs no API call.
 *
 * Stored in sessionStorage: cleared when the tab closes and by the inactivity
 * lock. Generations are LRU-capped; JD analyses are small and not capped.
 */
import { JDExtractionResult, ResumeBuilderOutput } from '@/types';

const RUN_PREFIX = 'rb_cache_run_';
const JD_PREFIX = 'rb_cache_jd_';
/** JSON list of cached generation hashes, least recently used first. */
const LRU_INDEX_KEY = 'rb_cache_keys';
export const MAX_CACHED_GENERATIONS = 10;

/** SHA-256 of `content`, as lowercase hex. */
export async function computeHash(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Cache key for a generation: every input that changes the result. */
export function generationCacheKey(input: { resume: string; jobDescription: string; companyName: string; model: string }): Promise<string> {
  // Property order is part of the hash — keep it stable.
  const { resume, jobDescription, companyName, model } = input;
  return computeHash(JSON.stringify({ resume, jobDescription, companyName, model }));
}

/** Parses a stored JSON value, logging (not throwing) if it is corrupt. */
function readJson<T>(key: string, label: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`Failed to parse ${label}:`, e);
    return null;
  }
}

/** Stores a JSON value, logging (not throwing) on quota or serialization errors. */
function writeJson(key: string, value: unknown, label: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Failed to set ${label}:`, e);
    return false;
  }
}

/** Marks `hash` most recently used and evicts the oldest generations over the cap. */
function touchLru(hash: string): void {
  try {
    const keys = (readJson<string[]>(LRU_INDEX_KEY, 'cache keys') ?? []).filter((k) => k !== hash);
    keys.push(hash);
    while (keys.length > MAX_CACHED_GENERATIONS) {
      const evicted = keys.shift();
      if (evicted) sessionStorage.removeItem(RUN_PREFIX + evicted);
    }
    sessionStorage.setItem(LRU_INDEX_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error('Failed to update cache keys:', e);
  }
}

export function readCachedGeneration(hash: string): ResumeBuilderOutput | null {
  const cached = readJson<ResumeBuilderOutput>(RUN_PREFIX + hash, 'cache entry');
  if (cached) touchLru(hash);
  return cached;
}

export function writeCachedGeneration(hash: string, output: ResumeBuilderOutput): void {
  if (writeJson(RUN_PREFIX + hash, output, 'cache entry')) touchLru(hash);
}

export function readCachedJdAnalysis(hash: string): JDExtractionResult | null {
  return readJson<JDExtractionResult>(JD_PREFIX + hash, 'JD cache entry');
}

export function writeCachedJdAnalysis(hash: string, analysis: JDExtractionResult): void {
  writeJson(JD_PREFIX + hash, analysis, 'JD cache entry');
}
