import { useState, useCallback, useEffect } from 'react';
import { ResumeBuilderOutput, Recommendation, JDExtractionResult, ManualEdit } from '@/types';
import { ApiErrorResponse, toApiErrorResponse } from '@/types/error';
import { resumeDataToText } from '@/lib/utils/string';
import { ANTHROPIC_DEFAULT_MODEL, RESUME_STORAGE_KEY } from '@/lib/constants';
import { getAtPath } from '@/lib/utils/path';
import { mergeManualEdits, readEditTarget, recordEdit, writeEditTarget } from '@/lib/utils/manualEdits';
import {
  computeHash,
  generationCacheKey,
  readCachedGeneration,
  readCachedJdAnalysis,
  writeCachedGeneration,
  writeCachedJdAnalysis,
} from '@/lib/cache/generationCache';

/** Every API route answers `{ success: true, data }` or an ApiErrorResponse. */
type ApiResult<T> = { success: true; data: T } | ApiErrorResponse;

/** POSTs JSON and returns the parsed body, whatever the HTTP status. */
async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Shape of /api/generate's data in refine mode. */
interface RefineResult {
  resume: ResumeBuilderOutput['resume'];
  coverLetter?: ResumeBuilderOutput['coverLetter'];
  updatedMatchScore?: number;
  hallucinationReport?: ResumeBuilderOutput['hallucinationReport'];
}

/** The cached keyword analysis for a job description, if there is one. */
async function cachedJdAnalysisFor(jobDescription: string): Promise<JDExtractionResult | null> {
  return readCachedJdAnalysis(await computeHash(jobDescription));
}

export function useGenerate() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJD] = useState('');
  const [companyName, setCompany] = useState('');
  const [selectedModel, setSelectedModel] = useState(ANTHROPIC_DEFAULT_MODEL);
  const [output, setOutput] = useState<ResumeBuilderOutput | null>(null);
  /** The first result of the latest generation; refine and revert work from it. */
  const [originalOutput, setOriginalOutput] = useState<ResumeBuilderOutput | null>(null);
  const [jdKeywords, setJdKeywords] = useState<JDExtractionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  /** True when `error` came from generation, so the banner can offer a retry. */
  const [isGenerationError, setIsGenerationError] = useState(false);
  const [manualEdits, setManualEdits] = useState<ManualEdit[]>([]);
  /** Edits a refine could not re-apply, shown to the user per tab. */
  const [orphanedEdits, setOrphanedEdits] = useState<ManualEdit[]>([]);

  const clearError = useCallback(() => setError(null), []);
  const setFatalError = useCallback((message: string) => {
    setError({ success: false, error: { type: 'FATAL', message } });
  }, []);

  const clearOrphanedEdits = useCallback((prefix?: 'resume' | 'coverLetter') => {
    setOrphanedEdits((prev) => (prefix ? prev.filter((e) => !e.path.startsWith(prefix)) : []));
  }, []);

  const handleManualEdit = useCallback((path: string, newValue: string) => {
    setOutput((prev) => {
      if (!prev) return null;
      // Record the edit against the generated text it replaces. A field that
      // is not text (or missing) is recorded as its string form, or ''.
      const originalValue = readEditTarget(prev, path) ?? String(getAtPath(prev, path) ?? '');
      setManualEdits((edits) => recordEdit(edits, { path, originalValue, editedValue: newValue }));
      return writeEditTarget(prev, path, newValue);
    });
    // Only state setters are used, and React guarantees those are stable.
  }, []);

  // Restore the saved resume draft on first load.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(RESUME_STORAGE_KEY);
      if (saved) setResume(saved);
    }
  }, []);

  const handleResumeChange = useCallback((v: string) => {
    setResume(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(RESUME_STORAGE_KEY, v);
    }
  }, []);

  // A different JD needs a fresh keyword analysis.
  useEffect(() => {
    setJdKeywords(null);
  }, [jobDescription]);

  const handleGenerate = useCallback(
    async (anthropicKey?: string) => {
      setIsGenerationError(false);
      setError(null);
      setManualEdits([]);
      setOrphanedEdits([]);

      /** Shows an API failure, flagged as retryable from the banner. */
      const failWith = (failure: ApiErrorResponse) => {
        setIsGenerationError(true);
        setError(failure);
      };

      try {
        const [runHash, jdHash] = await Promise.all([
          generationCacheKey({ resume, jobDescription, companyName, model: selectedModel }),
          computeHash(jobDescription),
        ]);

        // Check the cache before touching loading state, so a hit never flashes a spinner.
        const cached = readCachedGeneration(runHash);
        if (cached) {
          setOutput(cached);
          setOriginalOutput(cached);
          const cachedJd = readCachedJdAnalysis(jdHash);
          if (cachedJd) setJdKeywords(cachedJd);
          return;
        }

        setIsLoading(true);
        setOutput(null);
        setOriginalOutput(null);

        // 1. Keyword analysis of the JD (cached per JD).
        let extracted = readCachedJdAnalysis(jdHash);
        if (!extracted) {
          const jdResult = await postJson<JDExtractionResult>('/api/analyze-jd', {
            jobDescription,
            companyName: companyName || undefined,
            anthropicKey: anthropicKey || undefined,
          });
          if (!jdResult.success) return failWith(jdResult);
          extracted = jdResult.data;
          writeCachedJdAnalysis(jdHash, extracted);
        }
        setJdKeywords(extracted);

        // 2. Generation, given the extracted keywords so they are not re-derived.
        const result = await postJson<ResumeBuilderOutput>('/api/generate', {
          resume,
          jobDescription,
          companyName: companyName || undefined,
          anthropicKey: anthropicKey || undefined,
          model: selectedModel,
          mode: 'generate',
          jdKeywords: extracted,
        });
        if (!result.success) return failWith(result);

        setOutput(result.data);
        setOriginalOutput(result.data);
        writeCachedGeneration(runHash, result.data);
      } catch (e) {
        failWith(toApiErrorResponse(e));
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
        const result = await postJson<RefineResult>('/api/generate', {
          resume,
          jobDescription,
          companyName: companyName || undefined,
          anthropicKey: anthropicKey || undefined,
          model: selectedModel,
          mode: 'refine',
          // Refine the current, possibly hand-edited, text.
          currentOutput: {
            resume: output?.resume ?? originalOutput.resume,
            coverLetter: output?.coverLetter ?? originalOutput.coverLetter,
          },
          selectedRecommendations,
          jdKeywords: (await cachedJdAnalysisFor(jobDescription)) || undefined,
        });
        if (!result.success) {
          setError(result);
          return false;
        }

        const refined = result.data;
        // Carry the user's edits over to the refined text where they still fit.
        const { merged, kept, orphaned } = mergeManualEdits(
          { resume: refined.resume, coverLetter: refined.coverLetter },
          manualEdits
        );
        setOrphanedEdits((prev) => [...prev, ...orphaned]);
        setManualEdits(kept);

        setOutput((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            resume: merged.resume,
            coverLetter: merged.coverLetter,
            gapAnalysis: {
              ...prev.gapAnalysis,
              matchScore: refined.updatedMatchScore ?? prev.gapAnalysis.matchScore,
            },
            hallucinationReport: refined.hallucinationReport ?? prev.hallucinationReport,
          };
        });
        return true;
      } catch (e) {
        setError(toApiErrorResponse(e));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [resume, jobDescription, companyName, originalOutput, output, selectedModel, manualEdits]
  );

  const handleRevert = useCallback(() => {
    if (originalOutput) {
      setOutput(originalOutput);
      setManualEdits([]);
      setOrphanedEdits([]);
    }
  }, [originalOutput]);

  /**
   * Re-analyses the current resume against the JD and appends any genuinely
   * new recommendations. The score and keyword lists are kept, so applied or
   * selected recommendations stay valid.
   */
  const handleRefreshRecommendations = useCallback(
    async (anthropicKey?: string): Promise<boolean> => {
      if (!output) return false;
      setIsLoading(true);
      setError(null);

      try {
        const result = await postJson<ResumeBuilderOutput>('/api/generate', {
          resume: resumeDataToText(output.resume),
          jobDescription,
          companyName: companyName || undefined,
          anthropicKey: anthropicKey || undefined,
          model: selectedModel,
          mode: 'generate',
          jdKeywords: (await cachedJdAnalysisFor(jobDescription)) || undefined,
        });
        if (!result.success) {
          setError(result);
          return false;
        }

        const fresh = result.data.gapAnalysis;
        setOutput((prev) => {
          if (!prev) return null;
          // Recommendations are the same if their claims match, ignoring case and spacing.
          const claimKey = (claim: string) => claim.trim().toLowerCase();
          const existingClaims = new Set(prev.gapAnalysis.recommendations.map((r) => claimKey(r.claim)));
          const newRecs = fresh.recommendations.filter((r) => !existingClaims.has(claimKey(r.claim)));

          return {
            ...prev,
            gapAnalysis: {
              // Fresh analysis first, so every required field is present…
              ...fresh,
              // …then pin the fields the current score and UI state depend on.
              matchScore: prev.gapAnalysis.matchScore,
              keywordsAdded: prev.gapAnalysis.keywordsAdded,
              strongMatches: prev.gapAnalysis.strongMatches,
              recommendations: [...prev.gapAnalysis.recommendations, ...newRecs],
            },
          };
        });
        return true;
      } catch (e) {
        setError(toApiErrorResponse(e));
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
    setJD,
    setCompany,
    handleResumeChange,
    output,
    originalOutput,
    jdKeywords,
    isLoading,
    error,
    isGenerationError,
    setFatalError,
    clearError,
    handleGenerate,
    handleRefine,
    handleRevert,
    handleRefreshRecommendations,
    manualEdits,
    orphanedEdits,
    clearOrphanedEdits,
    handleManualEdit,
  };
}
