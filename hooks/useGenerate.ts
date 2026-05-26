'use client';

import { useState, useCallback, useEffect } from 'react';
import { ResumeBuilderOutput, Recommendation } from '@/types';
import { resumeDataToText } from '@/lib/utils/string';

const LOCAL_RESUME = 'rb_resume';
const CACHE_KEYS_KEY = 'rb_cache_keys';
const MAX_CACHE_SIZE = 10;

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCachedData(hash: string): ResumeBuilderOutput | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`rb_cache_run_${hash}`);
    if (cached) {
      const parsed = JSON.parse(cached) as ResumeBuilderOutput;
      updateLruKeys(hash);
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse cache entry:', e);
  }
  return null;
}

function setCachedData(hash: string, data: ResumeBuilderOutput) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`rb_cache_run_${hash}`, JSON.stringify(data));
    updateLruKeys(hash);
  } catch (e) {
    console.error('Failed to set cache entry:', e);
  }
}

function updateLruKeys(hash: string) {
  try {
    const keysStr = sessionStorage.getItem(CACHE_KEYS_KEY);
    let keys: string[] = keysStr ? JSON.parse(keysStr) : [];
    
    // Filter out existing occurrence
    keys = keys.filter((k) => k !== hash);
    
    // Add to the end (MRU)
    keys.push(hash);
    
    // Evict oldest entries if cache limit is exceeded
    while (keys.length > MAX_CACHE_SIZE) {
      const evictedHash = keys.shift();
      if (evictedHash) {
        sessionStorage.removeItem(`rb_cache_run_${evictedHash}`);
      }
    }
    
    sessionStorage.setItem(CACHE_KEYS_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error('Failed to update cache keys:', e);
  }
}

export function useGenerate() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJD] = useState('');
  const [companyName, setCompany] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [output, setOutput] = useState<ResumeBuilderOutput | null>(null);
  const [originalOutput, setOriginalOutput] = useState<ResumeBuilderOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_RESUME);
      if (saved) setResume(saved);
    }
  }, []);

  const handleResumeChange = useCallback((v: string) => {
    setResume(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_RESUME, v);
    }
  }, []);

  const handleGenerate = useCallback(
    async (anthropicKey?: string) => {
      setError(null);

      try {
        const fullCacheHash = await computeHash(
          JSON.stringify({ resume, jobDescription, companyName, model: selectedModel })
        );

        // Check cache before setting loading states to prevent unnecessary flashes
        const cachedData = getCachedData(fullCacheHash);
        if (cachedData) {
          setOutput(cachedData);
          setOriginalOutput(cachedData);
          return;
        }

        // Cache miss: proceed with loading and API call
        setIsLoading(true);
        setOutput(null);
        setOriginalOutput(null);

        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume,
            jobDescription,
            companyName: companyName || undefined,
            anthropicKey: anthropicKey || undefined,
            model: selectedModel,
            mode: 'generate',
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Generation failed');

        const data = json.data as ResumeBuilderOutput;

        setOutput(data);
        setOriginalOutput(data);
        setCachedData(fullCacheHash, data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [resume, jobDescription, companyName, selectedModel]
  );

  const handleRefine = useCallback(
    async (selectedRecommendations: Recommendation[], anthropicKey?: string): Promise<boolean> => {
      if (!originalOutput) return false;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume,
            jobDescription,
            companyName: companyName || undefined,
            anthropicKey: anthropicKey || undefined,
            model: selectedModel,
            mode: 'refine',
            currentOutput: {
              resume: output?.resume ?? originalOutput.resume,
              coverLetter: output?.coverLetter ?? originalOutput.coverLetter,
            },
            selectedRecommendations,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Refinement failed');

        // Refine mode returns { resume, coverLetter, updatedMatchScore }
        const refined = json.data;

        setOutput((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            resume: refined.resume,
            coverLetter: refined.coverLetter,
            gapAnalysis: {
              ...prev.gapAnalysis,
              matchScore: refined.updatedMatchScore ?? prev.gapAnalysis.matchScore,
            },
          };
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [resume, jobDescription, companyName, originalOutput, output, selectedModel]
  );

  const handleRevert = useCallback(() => {
    if (originalOutput) {
      setOutput(originalOutput);
    }
  }, [originalOutput]);

  const handleRefreshRecommendations = useCallback(
    async (anthropicKey?: string): Promise<boolean> => {
      if (!output) return false;
      setIsLoading(true);
      setError(null);

      try {
        const textResume = resumeDataToText(output.resume);
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resume: textResume,
            jobDescription,
            companyName: companyName || undefined,
            anthropicKey: anthropicKey || undefined,
            model: selectedModel,
            mode: 'generate',
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Refresh failed');

        const data = json.data as ResumeBuilderOutput;

        setOutput((prev) => {
          if (!prev) return null;

          // Keep all existing recs — never wipe applied/selected state.
          // Append only genuinely new ones (deduplicated by normalised claim text).
          const existingClaims = new Set(
            prev.gapAnalysis.recommendations.map((r) =>
              r.claim.trim().toLowerCase()
            )
          );
          const newRecs = data.gapAnalysis.recommendations.filter(
            (r) => !existingClaims.has(r.claim.trim().toLowerCase())
          );

          return {
            ...prev,
            gapAnalysis: {
              // Spread fresh analysis first so all required GapAnalysis fields are present
              // (gaps, missingKeywords, summaryChanges, dealbreakers, etc.)
              ...data.gapAnalysis,
              // Then pin the score-sensitive fields to the previous values so a
              // non-deterministic re-score never regresses the displayed ATS score.
              // Score should only update via an explicit refine (updatedMatchScore).
              matchScore: prev.gapAnalysis.matchScore,
              keywordsAdded: prev.gapAnalysis.keywordsAdded,
              strongMatches: prev.gapAnalysis.strongMatches,
              recommendations: [
                ...prev.gapAnalysis.recommendations,         // preserve existing (applied ones intact)
                ...newRecs,                                   // append only net-new gaps
              ],
            },
          };
        });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [output, jobDescription, companyName, selectedModel]
  );

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
    isLoading,
    error,
    handleGenerate,
    handleRefine,
    handleRevert,
    handleRefreshRecommendations,
  };
}
