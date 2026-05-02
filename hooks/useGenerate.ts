'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSectionCache } from './useSectionCache';
import { parseSections, SectionKey } from '@/lib/sectionParser';
import { ResumeBuilderOutput } from '@/types';
import { ProviderConfig } from './useProviderConfig';

const LOCAL_RESUME = 'rb_resume';

export type GenerationResult = {
  result: ResumeBuilderOutput;
  providerUsed: string;
  fallbackOccurred: boolean;
  fallbackReason?: string;
};

export interface UseGenerateReturn {
  // Content inputs
  resume:        string;
  jobDescription:string;
  companyName:   string;
  setResume:     (v: string) => void;
  setJD:         (v: string) => void;
  setCompany:    (v: string) => void;
  handleResumeChange: (v: string) => void; // also persists to localStorage

  // Generation state
  output:        GenerationResult | null;
  originalOutput:GenerationResult | null;
  isLoading:     boolean;
  error:         string | null;

  // Actions
  handleGenerate: () => Promise<void>;
  /** Overwrite output (used by useRefine to merge updated resume) */
  setOutput:      React.Dispatch<React.SetStateAction<GenerationResult | null>>;
  /** Restore output to the original locked result */
  restoreOriginal:() => void;
}

export function useGenerate(config: ProviderConfig): UseGenerateReturn {
  const [resume,         setResume]          = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_RESUME);
    if (saved) setResume(saved);
  }, []);
  const [jobDescription, setJD]             = useState('');
  const [companyName,    setCompany]         = useState('');
  const [output,         setOutput]          = useState<GenerationResult | null>(null);
  const [originalOutput, setOriginalOutput]  = useState<GenerationResult | null>(null);
  const [isLoading,      setIsLoading]       = useState(false);
  const [error,          setError]           = useState<string | null>(null);

  const handleResumeChange = useCallback((v: string) => {
    setResume(v);
    localStorage.setItem(LOCAL_RESUME, v);
  }, []);

  const { getCachedSection, setCachedSection, invalidateSummary } = useSectionCache();

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setOutput(null);
    setOriginalOutput(null);
    config.unlockProvider(); // reset lock so provider can't be changed mid-gen
    try {
      const parsedSections = parseSections(resume);
      const sectionsToGenerate: SectionKey[] = [];
      const cachedData: Partial<Record<SectionKey, any>> = {};

      // 1. Check Cache for all sections
      for (const [key, text] of Object.entries(parsedSections)) {
        if (!text) continue;
        const cached = await getCachedSection(key, text, jobDescription);
        if (cached) {
          cachedData[key as SectionKey] = cached;
        } else {
          sectionsToGenerate.push(key as SectionKey);
        }
      }

      // 2. Summary Invalidation Rule: Always regenerate summary if any other section is regenerating
      if (sectionsToGenerate.length > 0 && !sectionsToGenerate.includes('summary')) {
        sectionsToGenerate.push('summary');
        delete cachedData['summary'];
        invalidateSummary();
      }

      // 3. Request API
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume,
          jobDescription,
          companyName: companyName || undefined,
          provider:       config.provider,
          anthropicKey:   config.anthropicKey   || undefined,
          openaiKey:      config.openaiKey      || undefined,
          anthropicModel: config.anthropicModel || undefined,
          openaiModel:    config.openaiModel    || undefined,
          ollamaModel:    config.ollamaModel    || undefined,
          sections:       sectionsToGenerate.length === 0 ? 'all' : sectionsToGenerate,
        }),
      });

      // 429 from rate-limiting middleware — surface a friendly countdown message
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        const secs = j.retryAfterSeconds ?? 60;
        throw new Error(`Rate limit reached. Please wait ${secs} seconds before generating again.`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Generation failed');

      const data = json.data as GenerationResult;

      // 4. Update Cache with freshly generated sections
      for (const key of sectionsToGenerate) {
        const text = parsedSections[key as SectionKey];
        const freshSectionData = data.result.resume[key as keyof typeof data.result.resume];
        if (text && freshSectionData) {
          await setCachedSection(key, text, jobDescription, freshSectionData);
        }
      }

      // 5. Merge Cached Data back into the result
      if (sectionsToGenerate.length > 0) {
        for (const [key, cachedContent] of Object.entries(cachedData)) {
           // We cast heavily here since the structure matches the resume object
           (data.result.resume as any)[key] = cachedContent;
        }
      }

      setOutput(data);
      setOriginalOutput(data); // locked — never overwritten by refine
      setJD('');
      config.lockProvider();        // T5.4: lock provider after successful generation
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [resume, jobDescription, companyName, config]);

  const restoreOriginal = useCallback(() => {
    if (originalOutput) setOutput(originalOutput);
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
    setOutput,
    restoreOriginal,
  };
}
