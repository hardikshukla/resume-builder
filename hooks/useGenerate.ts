'use client';

import { useState, useCallback, useEffect } from 'react';
import { ResumeBuilderOutput } from '@/types';

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
          JSON.stringify({ resume, jobDescription, companyName })
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
    [resume, jobDescription, companyName]
  );

  const handleRefine = useCallback(
    async (selectedRecommendations: string[], anthropicKey?: string) => {
      if (!originalOutput) return;
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [resume, jobDescription, companyName, originalOutput, output]
  );

  const handleRevert = useCallback(() => {
    if (originalOutput) {
      setOutput(originalOutput);
    }
  }, [originalOutput]);

  return {
    resume,
    jobDescription,
    companyName,
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
  };
}
