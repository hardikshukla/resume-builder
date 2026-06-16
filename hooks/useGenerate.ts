import { useState, useCallback, useEffect } from 'react';
import { ResumeBuilderOutput, Recommendation, JDExtractionResult } from '@/types';
import { ApiErrorResponse, toApiErrorResponse } from '@/types/error';
import { resumeDataToText } from '@/lib/utils/string';
import { ANTHROPIC_DEFAULT_MODEL } from '@/lib/constants';
import { getAtPath, setAtPath, levenshtein } from '@/lib/utils/path';

export type ManualEdit = {
  path: string;
  originalValue: string;
  editedValue: string;
};

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

function getCachedJdAnalysis(hash: string): JDExtractionResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(`rb_cache_jd_${hash}`);
    if (cached) {
      return JSON.parse(cached) as JDExtractionResult;
    }
  } catch (e) {
    console.error('Failed to parse JD cache entry:', e);
  }
  return null;
}

function setCachedJdAnalysis(hash: string, data: JDExtractionResult) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`rb_cache_jd_${hash}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to set JD cache entry:', e);
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
  const [selectedModel, setSelectedModel] = useState(ANTHROPIC_DEFAULT_MODEL);
  const [output, setOutput] = useState<ResumeBuilderOutput | null>(null);
  const [originalOutput, setOriginalOutput] = useState<ResumeBuilderOutput | null>(null);
  const [jdKeywords, setJdKeywords] = useState<JDExtractionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiErrorResponse | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const setFatalError = useCallback((message: string) => {
    setError({ success: false, error: { type: 'FATAL', message } });
  }, []);

  const [isGenerationError, setIsGenerationError] = useState(false);

  const [manualEdits, setManualEdits] = useState<ManualEdit[]>([]);
  const [orphanedEdits, setOrphanedEdits] = useState<ManualEdit[]>([]);
  const clearOrphanedEdits = useCallback((prefix?: 'resume' | 'coverLetter') => {
    if (prefix) {
      setOrphanedEdits((prev) => prev.filter((e) => !e.path.startsWith(prefix)));
    } else {
      setOrphanedEdits([]);
    }
  }, []);

  const handleManualEdit = useCallback((path: string, newValue: string) => {
    setOutput((prev) => {
      if (!prev) return null;
      
      let originalValue: any;
      let resolvedOriginal: any;
      let resolvedNewValue: any = newValue;
      let updatedOutput = prev;

      const bodyMatch = path.match(/^coverLetter\.body\[(\d+)\]$/);
      if (bodyMatch) {
        const paragraphs = (prev.coverLetter?.body || '').split('\n').filter(Boolean);
        const index = parseInt(bodyMatch[1], 10);
        originalValue = paragraphs[index] || '';
        resolvedOriginal = originalValue;
        
        paragraphs[index] = newValue;
        resolvedNewValue = paragraphs.join('\n\n');
        
        updatedOutput = setAtPath(prev, 'coverLetter.body', resolvedNewValue);
      } else {
        originalValue = getAtPath(prev, path) ?? '';
        resolvedOriginal = originalValue;
        if (Array.isArray(originalValue)) {
          resolvedOriginal = originalValue.join(', ');
        }
        
        if (path.match(/^resume\.skills\[\d+\]\.items$/)) {
          resolvedNewValue = newValue.split(',').map((s) => s.trim()).filter(Boolean);
        }
        
        updatedOutput = setAtPath(prev, path, resolvedNewValue);
      }

      setManualEdits((prevEdits) => {
        const existingIdx = prevEdits.findIndex((e) => e.path === path);
        if (existingIdx !== -1) {
          const updated = [...prevEdits];
          updated[existingIdx] = {
            ...updated[existingIdx],
            editedValue: newValue,
          };
          return updated;
        } else {
          return [...prevEdits, { path, originalValue: String(resolvedOriginal), editedValue: newValue }];
        }
      });

      return updatedOutput;
    });
  }, [originalOutput]);

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

  // Reset JD keywords when JD changes
  useEffect(() => {
    setJdKeywords(null);
  }, [jobDescription]);

  const handleGenerate = useCallback(
    async (anthropicKey?: string) => {
      setIsGenerationError(false);
      setError(null);
      setManualEdits([]);
      setOrphanedEdits([]);

      try {
        const fullCacheHash = await computeHash(
          JSON.stringify({ resume, jobDescription, companyName, model: selectedModel })
        );

        // Check cache before setting loading states to prevent unnecessary flashes
        const cachedData = getCachedData(fullCacheHash);
        if (cachedData) {
          setOutput(cachedData);
          setOriginalOutput(cachedData);
          
          const jdHash = await computeHash(jobDescription);
          const cachedJd = getCachedJdAnalysis(jdHash);
          if (cachedJd) {
            setJdKeywords(cachedJd);
          }
          return;
        }

        // Cache miss: proceed with loading and sequential calls
        setIsLoading(true);
        setOutput(null);
        setOriginalOutput(null);

        // 1. Get JD Keywords analysis (cached or endpoint)
        const jdHash = await computeHash(jobDescription);
        let extracted = getCachedJdAnalysis(jdHash);

        if (!extracted) {
          const jdRes = await fetch('/api/analyze-jd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobDescription,
              companyName: companyName || undefined,
              anthropicKey: anthropicKey || undefined,
            }),
          });

          const jdJson = await jdRes.json();
          if (!jdJson.success) {
            setIsGenerationError(true);
            setError(jdJson as ApiErrorResponse);
            return;
          }
          extracted = jdJson.data as JDExtractionResult;
          setCachedJdAnalysis(jdHash, extracted);
        }

        setJdKeywords(extracted);

        // 2. Call main generate endpoint passing keywords context
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
            jdKeywords: extracted,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          setIsGenerationError(true);
          setError(json as ApiErrorResponse);
          return;
        }

        const data = json.data as ResumeBuilderOutput;

        setOutput(data);
        setOriginalOutput(data);
        setCachedData(fullCacheHash, data);
      } catch (e) {
        setIsGenerationError(true);
        setError(toApiErrorResponse(e));
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
        const jdHash = await computeHash(jobDescription);
        const cachedJd = getCachedJdAnalysis(jdHash);

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
            jdKeywords: cachedJd || undefined,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          setError(json as ApiErrorResponse);
          return false;
        }

        // Refine mode returns { resume, coverLetter, updatedMatchScore }
        const refined = json.data;

        // Run fuzzy merge of manualEdits on refined output
        const nextOrphaned: ManualEdit[] = [];
        const nextManualEdits: ManualEdit[] = [];
        let mergedOutputTemp = {
          resume: refined.resume,
          coverLetter: refined.coverLetter,
        };

        for (const edit of manualEdits) {
          const bodyMatch = edit.path.match(/^coverLetter\.body\[(\d+)\]$/);
          if (bodyMatch) {
            const index = parseInt(bodyMatch[1], 10);
            const paragraphs = (mergedOutputTemp.coverLetter?.body || '').split('\n').filter(Boolean);
            const targetValue = paragraphs[index] || '';
            
            if (targetValue === edit.originalValue) {
              paragraphs[index] = edit.editedValue;
              mergedOutputTemp = setAtPath(mergedOutputTemp, 'coverLetter.body', paragraphs.join('\n\n'));
              nextManualEdits.push(edit);
            } else if (levenshtein(targetValue, edit.originalValue) <= 3) {
              paragraphs[index] = edit.editedValue;
              mergedOutputTemp = setAtPath(mergedOutputTemp, 'coverLetter.body', paragraphs.join('\n\n'));
              nextManualEdits.push({
                ...edit,
                originalValue: targetValue,
              });
            } else {
              nextOrphaned.push(edit);
            }
          } else {
            let targetValue = getAtPath(mergedOutputTemp, edit.path);
            if (Array.isArray(targetValue)) {
              targetValue = targetValue.join(', ');
            }
            if (typeof targetValue === 'string') {
              if (targetValue === edit.originalValue) {
                let resolvedNewValue: any = edit.editedValue;
                if (edit.path.match(/^resume\.skills\[\d+\]\.items$/)) {
                  resolvedNewValue = edit.editedValue.split(',').map((s) => s.trim()).filter(Boolean);
                }
                mergedOutputTemp = setAtPath(mergedOutputTemp, edit.path, resolvedNewValue);
                nextManualEdits.push(edit);
              } else if (levenshtein(targetValue, edit.originalValue) <= 3) {
                let resolvedNewValue: any = edit.editedValue;
                if (edit.path.match(/^resume\.skills\[\d+\]\.items$/)) {
                  resolvedNewValue = edit.editedValue.split(',').map((s) => s.trim()).filter(Boolean);
                }
                mergedOutputTemp = setAtPath(mergedOutputTemp, edit.path, resolvedNewValue);
                nextManualEdits.push({
                  ...edit,
                  originalValue: targetValue,
                });
              } else {
                nextOrphaned.push(edit);
              }
            } else {
              nextOrphaned.push(edit);
            }
          }
        }

        setOrphanedEdits((prev) => [...prev, ...nextOrphaned]);
        setManualEdits(nextManualEdits);

        setOutput((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            resume: mergedOutputTemp.resume,
            coverLetter: mergedOutputTemp.coverLetter,
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

  const handleRefreshRecommendations = useCallback(
    async (anthropicKey?: string): Promise<boolean> => {
      if (!output) return false;
      setIsLoading(true);
      setError(null);

      try {
        const textResume = resumeDataToText(output.resume);
        const jdHash = await computeHash(jobDescription);
        const cachedJd = getCachedJdAnalysis(jdHash);

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
            jdKeywords: cachedJd || undefined,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          setError(json as ApiErrorResponse);
          return false;
        }

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
              ...data.gapAnalysis,
              // Then pin the score-sensitive fields to the previous values
              matchScore: prev.gapAnalysis.matchScore,
              keywordsAdded: prev.gapAnalysis.keywordsAdded,
              strongMatches: prev.gapAnalysis.strongMatches,
              recommendations: [
                ...prev.gapAnalysis.recommendations,         // preserve existing
                ...newRecs,                                   // append only net-new gaps
              ],
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
    setResume,
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
