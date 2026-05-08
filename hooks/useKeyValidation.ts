'use client';

import { useState, useCallback, useEffect } from 'react';
import { LLMProvider } from '@/types';

export type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface KeyValidationState {
  status:  ValidationStatus;
  detail:  string | null;   // e.g. "My Key · $0.0023 used · $10 limit"
  error:   string | null;   // e.g. "Invalid key — please check …"
}

export function useKeyValidation(provider: LLMProvider, key: string) {
  const [state, setState] = useState<KeyValidationState>({
    status: 'idle',
    detail: null,
    error:  null,
  });

  // Reset whenever the key changes
  useEffect(() => {
    setState({ status: 'idle', detail: null, error: null });
  }, [key]);

  const validate = useCallback(async () => {
    if (!key.trim()) return;
    setState({ status: 'validating', detail: null, error: null });
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = await res.json() as { valid: boolean; detail?: string; error?: string };

      if (data.valid) {
        setState({ status: 'valid', detail: data.detail ?? 'Key verified', error: null });
      } else {
        setState({ status: 'invalid', detail: null, error: data.error ?? 'Invalid key' });
      }
    } catch {
      setState({ status: 'invalid', detail: null, error: 'Network error — could not reach validation endpoint.' });
    }
  }, [provider, key]);

  return { ...state, validate };
}
