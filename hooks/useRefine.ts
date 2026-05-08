'use client';

import { useState, useCallback } from 'react';
import { ProviderConfig } from './useProviderConfig';
import { GenerationResult } from './useGenerate';

export interface UseRefineReturn {
  isRefining:  boolean;
  refineError: string | null;
  hasRefined:  boolean;
  appliedRecs: string[];

  handleRefine: (selectedRecs: string[]) => Promise<void>;
  handleRevert: () => void;
}

export function useRefine(
  originalOutput: GenerationResult | null,
  setOutput: React.Dispatch<React.SetStateAction<GenerationResult | null>>,
  restoreOriginal: () => void,
  config: ProviderConfig
): UseRefineReturn {
  const [isRefining,  setIsRefining]  = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [hasRefined,  setHasRefined]  = useState(false);
  // Tracks which recommendation strings are currently reflected in the refined resume.
  // Replaced on every new refine; cleared on revert.
  const [appliedRecs, setAppliedRecs] = useState<string[]>([]);

  const handleRefine = useCallback(async (selectedRecs: string[]) => {
    // Always refines from the ORIGINAL output — never chains on top of a previous refine.
    // Deselecting a recommendation and re-applying gives a clean result with only the
    // currently-selected items, with no residue from previous runs.
    if (!originalOutput) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentOutput:           originalOutput.result,
          selectedRecommendations: selectedRecs,
          provider:        config.provider,
          anthropicKey:    config.anthropicKey    || undefined,
          openaiKey:       config.openaiKey       || undefined,
          openrouterKey:   config.openrouterKey   || undefined,
          anthropicModel:  config.anthropicModel  || undefined,
          openaiModel:     config.openaiModel     || undefined,
          ollamaModel:     config.ollamaModel     || undefined,
          openrouterModel: config.openrouterModel || undefined,
        }),
      });

      // 429 from rate-limiting middleware — surface a friendly countdown message
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        const secs = j.retryAfterSeconds ?? 60;
        throw new Error(`Rate limit reached. Please wait ${secs} seconds before refining again.`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Refine failed');

      setOutput((prev) =>
        prev
          ? {
              ...prev,
              result: {
                ...prev.result,
                resume:      json.data.resume,
                coverLetter: json.data.coverLetter,
                gapAnalysis: {
                  ...prev.result.gapAnalysis,
                  ...(json.data.updatedMatchScore != null && {
                    matchScore: json.data.updatedMatchScore,
                  }),
                },
              },
            }
          : prev
      );

      setHasRefined(true);
      setAppliedRecs(selectedRecs); // record exactly what's now in the refined resume
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : 'Unknown refine error');
    } finally {
      setIsRefining(false);
    }
  }, [originalOutput, config, setOutput]);

  // Revert to original — zero tokens, zero API calls, instant.
  const handleRevert = useCallback(() => {
    restoreOriginal();
    setHasRefined(false);
    setAppliedRecs([]);
    setRefineError(null);
  }, [restoreOriginal]);

  return {
    isRefining,
    refineError,
    hasRefined,
    appliedRecs,
    handleRefine,
    handleRevert,
  };
}
