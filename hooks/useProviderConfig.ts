'use client';

import { useState, useEffect, useCallback } from 'react';
import { LLMProvider } from '@/types';

// ── sessionStorage keys ────────────────────────────────────────────────────────
const KEYS = {
  provider:       'rb_provider',
  anthropicKey:   'rb_apikey_anthropic',
  openaiKey:      'rb_apikey_openai',
  anthropicModel: 'rb_model_anthropic',
  openaiModel:    'rb_model_openai',
  ollamaModel:    'rb_model_ollama',
  dropboxToken:   'rb_dropbox_token',
  skipDropbox:    'rb_skip_dropbox_prompt',
};

export interface ProviderConfig {
  // Values
  provider:       LLMProvider;
  anthropicKey:   string;
  openaiKey:      string;
  anthropicModel: string;
  openaiModel:    string;
  ollamaModel:    string;
  /** True once a generation has succeeded — locks the provider selector */
  isLocked:       boolean;

  // Handlers
  setProvider:            (p: LLMProvider) => void;
  setAnthropicKey:        (v: string) => void;
  setOpenaiKey:           (v: string) => void;
  setAnthropicModel:      (v: string) => void;
  setOpenaiModel:         (v: string) => void;
  setOllamaModel:         (v: string) => void;
  /** Call after a successful generation to lock provider until reset */
  lockProvider:           () => void;
  /** Call to unlock (e.g. user clicks "Reset" or starts a new generation) */
  unlockProvider:         () => void;
  
  dropboxToken:           string;
  setDropboxToken:        (v: string) => void;
  skipDropboxPrompt:      boolean;
  setSkipDropboxPrompt:   (v: boolean) => void;
}

export function useProviderConfig(): ProviderConfig {
  const [provider,       setProviderState] = useState<LLMProvider>('anthropic');
  const [anthropicKey,   setAnthropicKey]  = useState('');
  const [openaiKey,      setOpenaiKey]     = useState('');
  const [anthropicModel, setAnthropicModel]= useState('');
  const [openaiModel,    setOpenaiModel]   = useState('');
  const [ollamaModel,    setOllamaModel]   = useState('');
  const [isLocked,       setIsLocked]      = useState(false);
  const [dropboxToken,   setDropboxTokenState]  = useState('');
  const [skipDropboxPrompt, setSkipDropboxState] = useState(false);

  // Rehydrate from sessionStorage on mount
  useEffect(() => {
    const ss = (k: string) => sessionStorage.getItem(k) ?? '';
    const p = ss(KEYS.provider) as LLMProvider;
    if (p) setProviderState(p);
    setAnthropicKey(ss(KEYS.anthropicKey));
    setOpenaiKey(ss(KEYS.openaiKey));
    setAnthropicModel(ss(KEYS.anthropicModel));
    setOpenaiModel(ss(KEYS.openaiModel));
    setOllamaModel(ss(KEYS.ollamaModel));
    setDropboxTokenState(ss(KEYS.dropboxToken));
    setSkipDropboxState(ss(KEYS.skipDropbox) === 'true');
  }, []);

  const setProvider = useCallback((p: LLMProvider) => {
    setProviderState(p);
    sessionStorage.setItem(KEYS.provider, p);
  }, []);

  const handleAnthropicKey = useCallback((v: string) => {
    setAnthropicKey(v);
    sessionStorage.setItem(KEYS.anthropicKey, v);
  }, []);

  const handleOpenaiKey = useCallback((v: string) => {
    setOpenaiKey(v);
    sessionStorage.setItem(KEYS.openaiKey, v);
  }, []);

  const handleAnthropicModel = useCallback((v: string) => {
    setAnthropicModel(v);
    sessionStorage.setItem(KEYS.anthropicModel, v);
  }, []);

  const handleOpenaiModel = useCallback((v: string) => {
    setOpenaiModel(v);
    sessionStorage.setItem(KEYS.openaiModel, v);
  }, []);

  const handleOllamaModel = useCallback((v: string) => {
    setOllamaModel(v);
    sessionStorage.setItem(KEYS.ollamaModel, v);
  }, []);

  const lockProvider   = useCallback(() => setIsLocked(true),  []);
  const unlockProvider = useCallback(() => setIsLocked(false), []);

  const setDropboxToken = useCallback((v: string) => {
    setDropboxTokenState(v);
    sessionStorage.setItem(KEYS.dropboxToken, v);
  }, []);

  const setSkipDropboxPrompt = useCallback((v: boolean) => {
    setSkipDropboxState(v);
    sessionStorage.setItem(KEYS.skipDropbox, v ? 'true' : 'false');
  }, []);

  return {
    provider,
    anthropicKey,
    openaiKey,
    anthropicModel,
    openaiModel,
    ollamaModel,
    isLocked,
    setProvider,
    setAnthropicKey:   handleAnthropicKey,
    setOpenaiKey:      handleOpenaiKey,
    setAnthropicModel: handleAnthropicModel,
    setOpenaiModel:    handleOpenaiModel,
    setOllamaModel:    handleOllamaModel,
    lockProvider,
    unlockProvider,
    dropboxToken,
    setDropboxToken,
    skipDropboxPrompt,
    setSkipDropboxPrompt,
  };
}
