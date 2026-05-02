'use client';

import { useCallback } from 'react';

/**
 * Computes a SHA-256 hash using the Web Crypto API
 */
async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useSectionCache() {
  const getCachedSection = useCallback(async (sectionKey: string, sectionText: string, jd: string) => {
    try {
      const hash = await computeHash(`${sectionKey}||${sectionText}||${jd}`);
      const cached = sessionStorage.getItem(`rb_cache_${sectionKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.hash === hash) {
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('Failed to read from section cache', e);
    }
    return null;
  }, []);

  const setCachedSection = useCallback(async (sectionKey: string, sectionText: string, jd: string, data: any) => {
    try {
      const hash = await computeHash(`${sectionKey}||${sectionText}||${jd}`);
      sessionStorage.setItem(`rb_cache_${sectionKey}`, JSON.stringify({ hash, data }));
    } catch (e) {
      console.warn('Failed to write to section cache', e);
    }
  }, []);

  const invalidateSummary = useCallback(() => {
    sessionStorage.removeItem('rb_cache_summary');
  }, []);

  return { getCachedSection, setCachedSection, invalidateSummary };
}
