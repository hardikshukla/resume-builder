/**
 * @jest-environment jsdom
 */
import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import {
  MAX_CACHED_GENERATIONS,
  computeHash,
  readCachedGeneration,
  writeCachedGeneration,
} from '@/lib/cache/generationCache';
import { ResumeBuilderOutput } from '@/types';

Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true });
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;

const output = { gapAnalysis: { matchScore: 1 }, resume: {} } as unknown as ResumeBuilderOutput;

beforeEach(() => {
  sessionStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('generationCache', () => {
  it('computeHash returns SHA-256 hex', async () => {
    expect(await computeHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('reading an entry makes it most recently used, so it survives eviction', () => {
    for (let i = 0; i < MAX_CACHED_GENERATIONS; i++) writeCachedGeneration(`h${i}`, output);
    readCachedGeneration('h0'); // touch the oldest
    writeCachedGeneration('new', output); // pushes the cache over the cap

    expect(readCachedGeneration('h0')).not.toBeNull();
    expect(readCachedGeneration('h1')).toBeNull(); // now the oldest, so evicted
  });

  it('recovers from a corrupted LRU index instead of failing every write', () => {
    sessionStorage.setItem('rb_cache_keys', '{not json');
    writeCachedGeneration('h', output);
    expect(JSON.parse(sessionStorage.getItem('rb_cache_keys')!)).toEqual(['h']);
  });

  it('treats a corrupted entry as a cache miss', () => {
    sessionStorage.setItem('rb_cache_run_bad', '{not json');
    expect(readCachedGeneration('bad')).toBeNull();
  });
});
