'use client';

import { useState, useCallback, useEffect } from 'react';
import { ResumeBuilderOutput, Recommendation } from '@/types';
import { resumeDataToText } from '@/lib/utils/string';

const LOCAL_RESUME = 'rb_resume';
const FULL_GENERATION_CACHE = 'rb_cache_full_generation';

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
      setIsLoading(true);
      setError(null);
      setOutput(null);
      setOriginalOutput(null);

      try {
        const fullCacheHash = await computeHash(
          JSON.stringify({ resume, jobDescription, companyName, model: selectedModel })
        );

        if (typeof window !== 'undefined') {
          const cachedFull = sessionStorage.getItem(FULL_GENERATION_CACHE);
          if (cachedFull) {
            try {
              const parsed = JSON.parse(cachedFull) as {
                hash?: string;
                data?: ResumeBuilderOutput;
              };
              if (parsed.hash === fullCacheHash && parsed.data) {
                setOutput(parsed.data);
                setOriginalOutput(parsed.data);
                setIsLoading(false);
                return;
              }
            } catch {
              sessionStorage.removeItem(FULL_GENERATION_CACHE);
            }
          }
        }

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

        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(
              FULL_GENERATION_CACHE,
              JSON.stringify({ hash: fullCacheHash, data })
            );
          } catch {
            sessionStorage.removeItem(FULL_GENERATION_CACHE);
          }
        }
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
              ...data.gapAnalysis,                          // refresh scores, dealbreakers, matches
              recommendations: [
                ...prev.gapAnalysis.recommendations,       // preserve existing (applied ones intact)
                ...newRecs,                                 // append only net-new gaps
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
