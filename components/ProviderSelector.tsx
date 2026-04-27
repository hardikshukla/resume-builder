'use client';

import { LLMProvider } from '@/types';
import { Eye, EyeOff, RefreshCw, ChevronDown } from 'lucide-react';
import { useState, useCallback } from 'react';

interface ModelEntry { id: string; name: string; }

interface ProviderSelectorProps {
  provider: LLMProvider;
  anthropicKey: string;
  openaiKey: string;
  anthropicModel: string;
  openaiModel: string;
  ollamaModel: string;
  onProviderChange: (p: LLMProvider) => void;
  onAnthropicKeyChange: (k: string) => void;
  onOpenaiKeyChange: (k: string) => void;
  onAnthropicModelChange: (m: string) => void;
  onOpenaiModelChange: (m: string) => void;
  onOllamaModelChange: (m: string) => void;
}

const PROVIDERS: { value: LLMProvider; label: string; badge: string; color: string }[] = [
  { value: 'anthropic', label: 'Claude',        badge: 'Primary',  color: 'badge-primary'   },
  { value: 'openai',    label: 'OpenAI',         badge: 'Fallback', color: 'badge-secondary' },
  { value: 'ollama',    label: 'Ollama (Local)', badge: 'Local',    color: 'badge-tertiary'  },
];

// ── Reusable password field ───────────────────────────────────────────────────
function KeyField({ id, label, placeholder, value, onChange }: {
  id: string; label: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="input-with-icon">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="text-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="icon-btn" onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide key' : 'Show key'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

// ── Model picker for a single provider ────────────────────────────────────────
function ModelPicker({ provider, apiKey, selectedModel, onModelChange, placeholder }: {
  provider: LLMProvider;
  apiKey?: string;
  selectedModel: string;
  onModelChange: (m: string) => void;
  placeholder: string;
}) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          anthropicKey: provider === 'anthropic' ? apiKey : undefined,
          openaiKey:    provider === 'openai'    ? apiKey : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Error ${res.status}`);
      setModels(json.models as ModelEntry[]);
      setFetched(true);
      // Auto-select first if nothing selected yet
      if (!selectedModel && json.models.length > 0) {
        onModelChange((json.models[0] as ModelEntry).id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey, selectedModel, onModelChange]);

  return (
    <div className="model-picker">
      <div className="model-picker-row">
        <label className="field-label" htmlFor={`model-${provider}`}>Model</label>
        <button
          type="button"
          className={`fetch-models-btn ${loading ? 'loading' : ''}`}
          onClick={fetchModels}
          disabled={loading || (provider !== 'ollama' && !apiKey)}
          title={provider !== 'ollama' && !apiKey ? 'Enter API key first' : 'Fetch available models'}
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} />
          {loading ? 'Fetching…' : fetched ? 'Refresh' : 'Fetch models'}
        </button>
      </div>

      {/* Dropdown — shown after fetch */}
      {fetched && models.length > 0 ? (
        <div className="model-select-wrap">
          <select
            id={`model-${provider}`}
            className="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="model-select-chevron" />
        </div>
      ) : (
        /* Manual text input fallback */
        <input
          id={`model-${provider}`}
          type="text"
          className="text-input"
          placeholder={placeholder}
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          spellCheck={false}
        />
      )}

      {error && <p className="model-fetch-error">{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ProviderSelector({
  provider, anthropicKey, openaiKey,
  anthropicModel, openaiModel, ollamaModel,
  onProviderChange, onAnthropicKeyChange, onOpenaiKeyChange,
  onAnthropicModelChange, onOpenaiModelChange, onOllamaModelChange,
}: ProviderSelectorProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">⚡</div>
        <h2 className="card-title">AI Provider</h2>
      </div>

      {/* Provider tabs */}
      <div className="provider-tabs">
        {PROVIDERS.map((p) => (
          <button key={p.value}
            onClick={() => onProviderChange(p.value)}
            className={`provider-tab ${provider === p.value ? 'active' : ''}`}
          >
            <span className="provider-name">{p.label}</span>
            <span className={`badge ${p.color}`}>{p.badge}</span>
          </button>
        ))}
      </div>

      <div className="key-fields">
        {/* ── Anthropic ── */}
        {provider === 'anthropic' && (<>
          <KeyField id="anthropic-key" label="Anthropic API Key"
            placeholder="sk-ant-..." value={anthropicKey} onChange={onAnthropicKeyChange} />
          <ModelPicker provider="anthropic" apiKey={anthropicKey}
            selectedModel={anthropicModel} onModelChange={onAnthropicModelChange}
            placeholder="claude-sonnet-4-6" />
          {/* Optional OpenAI fallback key */}
          <KeyField id="openai-fallback-key" label="OpenAI Key (optional fallback)"
            placeholder="sk-..." value={openaiKey} onChange={onOpenaiKeyChange} />
          {openaiKey && (
            <ModelPicker provider="openai" apiKey={openaiKey}
              selectedModel={openaiModel} onModelChange={onOpenaiModelChange}
              placeholder="gpt-4o" />
          )}
        </>)}

        {/* ── OpenAI ── */}
        {provider === 'openai' && (<>
          <KeyField id="openai-key" label="OpenAI API Key"
            placeholder="sk-..." value={openaiKey} onChange={onOpenaiKeyChange} />
          <ModelPicker provider="openai" apiKey={openaiKey}
            selectedModel={openaiModel} onModelChange={onOpenaiModelChange}
            placeholder="gpt-4o" />
          {/* Optional Anthropic fallback key */}
          <KeyField id="anthropic-fallback-key" label="Anthropic Key (optional fallback)"
            placeholder="sk-ant-..." value={anthropicKey} onChange={onAnthropicKeyChange} />
          {anthropicKey && (
            <ModelPicker provider="anthropic" apiKey={anthropicKey}
              selectedModel={anthropicModel} onModelChange={onAnthropicModelChange}
              placeholder="claude-sonnet-4-6" />
          )}
        </>)}

        {/* ── Ollama ── */}
        {provider === 'ollama' && (<>
          <p className="ollama-note">
            🖥️ Ollama runs locally — no API key needed. Ensure Ollama is running at{' '}
            <code>localhost:11434</code>.
          </p>
          <ModelPicker provider="ollama"
            selectedModel={ollamaModel} onModelChange={onOllamaModelChange}
            placeholder="llama3 (or click Fetch models)" />
        </>)}
      </div>

      <p className="key-security-note">
        🔒 Keys stored in session only · Never logged or sent to third parties
      </p>
    </div>
  );
}
