'use client';

import { LLMProvider } from '@/types';
import { Eye, EyeOff, RefreshCw, ChevronDown, Info, ExternalLink, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useKeyValidation } from '@/hooks/useKeyValidation';

// ── Provider metadata ─────────────────────────────────────────────────────────
interface ProviderMeta {
  value:    LLMProvider;
  label:    string;
  icon:     string;
  tagline:  string;
  badge:    string;
  badgeClass: string;
  keyDocs: {
    url:        string;
    urlLabel:   string;
    prefix:     string;
    freeTier:   string | null;
    description: string;
  } | null;
}

const PROVIDERS: ProviderMeta[] = [
  {
    value: 'anthropic',
    label: 'Claude',
    icon: '🧠',
    tagline: 'Best quality · prompt caching',
    badge: 'Recommended',
    badgeClass: 'badge-primary',
    keyDocs: {
      url: 'https://console.anthropic.com/settings/keys',
      urlLabel: 'console.anthropic.com',
      prefix: 'sk-ant-api03-...',
      freeTier: null,
      description: 'Create a free Anthropic account, then generate an API key from the Console. Note: Anthropic requires a paid plan to use the API.',
    },
  },
  {
    value: 'openai',
    label: 'OpenAI',
    icon: '⚡',
    tagline: 'GPT-4o · industry standard',
    badge: 'Fallback',
    badgeClass: 'badge-secondary',
    keyDocs: {
      url: 'https://platform.openai.com/api-keys',
      urlLabel: 'platform.openai.com',
      prefix: 'sk-proj-... or sk-...',
      freeTier: null,
      description: 'Log into OpenAI Platform, navigate to API Keys, and create a new secret key. Requires adding credit to your account.',
    },
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    icon: '🔀',
    tagline: '200+ models · free tier available',
    badge: 'Free Tier',
    badgeClass: 'badge-openrouter',
    keyDocs: {
      url: 'https://openrouter.ai/keys',
      urlLabel: 'openrouter.ai/keys',
      prefix: 'sk-or-v1-...',
      freeTier: '✅ Many free models available — no billing required',
      description: 'Sign up at OpenRouter, go to Keys, and create a new API key. Free models are rate-limited but require no payment.',
    },
  },
  {
    value: 'ollama',
    label: 'Ollama',
    icon: '🖥️',
    tagline: '100% local · no key needed',
    badge: 'Local',
    badgeClass: 'badge-tertiary',
    keyDocs: null,
  },
];

// ── Key Docs Popover ───────────────────────────────────────────────────────────
function KeyDocsPopover({ docs }: { docs: NonNullable<ProviderMeta['keyDocs']> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="key-docs-wrap" ref={ref}>
      <button
        type="button"
        className="key-docs-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label="How to get this key"
        title="How to get this key"
      >
        <Info size={13} />
      </button>

      {open && (
        <div className="key-docs-popover" role="dialog" aria-label="API key instructions">
          <button className="key-docs-close" onClick={() => setOpen(false)} aria-label="Close"><X size={12} /></button>
          <p className="key-docs-desc">{docs.description}</p>
          {docs.freeTier && <p className="key-docs-free">{docs.freeTier}</p>}
          <div className="key-docs-meta">
            <span className="key-docs-prefix">Format: <code>{docs.prefix}</code></span>
          </div>
          <a
            href={docs.url}
            target="_blank"
            rel="noopener noreferrer"
            className="key-docs-link"
          >
            Get API key <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Secure Key Field (with optional inline key validation) ────────────────────
function KeyField({ id, label, placeholder, value, onChange, docs, provider }: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  docs?: NonNullable<ProviderMeta['keyDocs']>;
  /** When provided, a Verify button is rendered */
  provider?: LLMProvider;
}) {
  const [show, setShow] = useState(false);
  const validation = useKeyValidation(provider ?? 'ollama', value);
  const canVerify = !!provider && value.trim().length > 8;

  return (
    <div className="field-group">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>{label}</label>
        {docs && <KeyDocsPopover docs={docs} />}
        {/* Verify button — only for providers that support validation */}
        {provider && (
          <button
            type="button"
            className={`key-verify-btn ${
              validation.status === 'validating' ? 'verifying' :
              validation.status === 'valid'      ? 'verified' :
              validation.status === 'invalid'    ? 'invalid'  : ''
            }`}
            onClick={validation.validate}
            disabled={!canVerify || validation.status === 'validating'}
            title={canVerify ? 'Verify API key' : 'Enter a key first'}
          >
            {validation.status === 'validating' ? (
              <><RefreshCw size={11} className="spin" /> Verifying…</>
            ) : validation.status === 'valid' ? (
              <><ShieldCheck size={11} /> Valid</>  
            ) : validation.status === 'invalid' ? (
              <><ShieldAlert size={11} /> Invalid</>
            ) : (
              <><ShieldCheck size={11} /> Verify</>
            )}
          </button>
        )}
      </div>

      <div className="input-with-icon">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`text-input ${
            validation.status === 'valid'   ? 'input-valid'   :
            validation.status === 'invalid' ? 'input-invalid' : ''
          }`}
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

      {/* Inline status messages */}
      {validation.status === 'valid' && validation.detail && (
        <p className="key-status key-status--valid">✅ {validation.detail}</p>
      )}
      {validation.status === 'invalid' && validation.error && (
        <p className="key-status key-status--invalid">❌ {validation.error}</p>
      )}
    </div>
  );
}

// ── Model Entry with optional isFree flag ──────────────────────────────────────
interface ModelEntry { id: string; name: string; isFree?: boolean; }

// ── Model Picker ───────────────────────────────────────────────────────────────
function ModelPicker({ provider, apiKey, selectedModel, onModelChange, placeholder, openrouterKey }: {
  provider: LLMProvider;
  apiKey?: string;
  openrouterKey?: string;
  selectedModel: string;
  onModelChange: (m: string) => void;
  placeholder: string;
}) {
  const [models,    setModels]   = useState<ModelEntry[]>([]);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState<string | null>(null);
  const [fetched,   setFetched]  = useState(false);
  const [freeOnly,  setFreeOnly] = useState(true);   // OpenRouter: default to free
  const [search,    setSearch]   = useState('');

  const effectiveKey = provider === 'openrouter' ? openrouterKey : apiKey;

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string | undefined> = { provider };
      if (provider === 'anthropic')  body.anthropicKey   = apiKey;
      if (provider === 'openai')     body.openaiKey      = apiKey;
      if (provider === 'openrouter') body.openrouterKey  = openrouterKey;

      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Error ${res.status}`);
      setModels(json.models as ModelEntry[]);
      setFetched(true);
      if (!selectedModel && json.models.length > 0) {
        // Auto-select first free model for OpenRouter, otherwise first model
        const firstFree = (json.models as ModelEntry[]).find(m => m.isFree);
        onModelChange((firstFree ?? json.models[0]).id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  }, [provider, apiKey, openrouterKey, selectedModel, onModelChange]);

  const canFetch = provider === 'ollama' || !!effectiveKey;

  // Filter models for display
  const displayed = models.filter(m => {
    const passFilter = provider !== 'openrouter' || !freeOnly || m.isFree;
    const passSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase());
    return passFilter && passSearch;
  });

  return (
    <div className="model-picker">
      <div className="model-picker-row">
        <label className="field-label" htmlFor={`model-${provider}`}>Model</label>
        <button
          type="button"
          className={`fetch-models-btn ${loading ? 'loading' : ''}`}
          onClick={fetchModels}
          disabled={loading || !canFetch}
          title={!canFetch ? 'Enter API key first' : 'Fetch available models'}
        >
          <RefreshCw size={12} className={loading ? 'spin' : ''} />
          {loading ? 'Fetching…' : fetched ? 'Refresh' : 'Fetch models'}
        </button>
      </div>

      {/* OpenRouter: free/paid toggle + search */}
      {provider === 'openrouter' && fetched && (
        <div className="or-filter-row">
          <div className="or-toggle">
            <button
              type="button"
              className={`or-toggle-btn ${freeOnly ? 'active' : ''}`}
              onClick={() => setFreeOnly(true)}
            >
              🆓 Free only
            </button>
            <button
              type="button"
              className={`or-toggle-btn ${!freeOnly ? 'active' : ''}`}
              onClick={() => setFreeOnly(false)}
            >
              💳 All models
            </button>
          </div>
          <input
            type="text"
            className="text-input or-search"
            placeholder="Search models…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {fetched && displayed.length > 0 ? (
        <div className="model-select-wrap">
          <select
            id={`model-${provider}`}
            className="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
          >
            {displayed.map((m) => (
              <option key={m.id} value={m.id}>
                {provider === 'openrouter'
                  ? `${m.isFree ? '🆓' : '💳'} ${m.name}`
                  : m.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="model-select-chevron" />
        </div>
      ) : fetched && displayed.length === 0 ? (
        <p className="model-fetch-error">No models match your filter.</p>
      ) : (
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

// ── Dropbox Field ─────────────────────────────────────────────────────────────
function DropboxField({ dropboxToken, onDropboxTokenChange }: {
  dropboxToken: string;
  onDropboxTokenChange: (k: string) => void;
}) {
  const [dbxStatus,  setDbxStatus]  = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [dbxMessage, setDbxMessage] = useState<string | null>(null);

  useEffect(() => {
    setDbxStatus('idle');
    setDbxMessage(null);
  }, [dropboxToken]);

  const verify = async () => {
    if (!dropboxToken) return;
    setDbxStatus('verifying');
    setDbxMessage(null);
    try {
      const res  = await fetch('/api/dropbox/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: dropboxToken }),
      });
      const data = await res.json();
      if (data.valid) {
        setDbxStatus('success');
        setDbxMessage(`Connected as ${data.account || 'User'}`);
      } else {
        setDbxStatus('error');
        setDbxMessage(data.error || 'Invalid token');
      }
    } catch {
      setDbxStatus('error');
      setDbxMessage('Network error during verification');
    }
  };

  return (
    <div className="dropbox-field-wrap">
      <KeyField
        id="dropbox-key"
        label="Dropbox Access Token (optional)"
        placeholder="sl.B..."
        value={dropboxToken}
        onChange={onDropboxTokenChange}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
        <button
          type="button"
          className={`fetch-models-btn ${dbxStatus === 'verifying' ? 'loading' : ''}`}
          onClick={verify}
          disabled={dbxStatus === 'verifying' || !dropboxToken}
        >
          {dbxStatus === 'verifying' ? (
            <><RefreshCw size={12} className="spin" /> Verifying…</>
          ) : dbxStatus === 'success' ? '✅ Verified'
            : dbxStatus === 'error'   ? '❌ Verify again'
            : 'Verify Connection'}
        </button>
        {dbxMessage && (
          <span style={{ fontSize: '0.75rem', color: dbxStatus === 'success' ? '#4ade80' : '#f87171' }}>
            {dbxMessage}
          </span>
        )}
      </div>
      <p className="ollama-note" style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-dim)' }}>
        To enable &quot;Save to Dropbox&quot;, generate a Personal Access Token in the{' '}
        <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          Dropbox App Console
        </a>.
      </p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ProviderSelectorProps {
  provider:         LLMProvider;
  anthropicKey:     string;
  openaiKey:        string;
  openrouterKey:    string;
  anthropicModel:   string;
  openaiModel:      string;
  ollamaModel:      string;
  openrouterModel:  string;
  onProviderChange:      (p: LLMProvider) => void;
  onAnthropicKeyChange:  (k: string) => void;
  onOpenaiKeyChange:     (k: string) => void;
  onOpenrouterKeyChange: (k: string) => void;
  onAnthropicModelChange:  (m: string) => void;
  onOpenaiModelChange:     (m: string) => void;
  onOllamaModelChange:     (m: string) => void;
  onOpenrouterModelChange: (m: string) => void;
  dropboxToken:           string;
  onDropboxTokenChange:   (k: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function ProviderSelector({
  provider,
  anthropicKey, openaiKey, openrouterKey,
  anthropicModel, openaiModel, ollamaModel, openrouterModel,
  onProviderChange,
  onAnthropicKeyChange, onOpenaiKeyChange, onOpenrouterKeyChange,
  onAnthropicModelChange, onOpenaiModelChange, onOllamaModelChange, onOpenrouterModelChange,
  dropboxToken, onDropboxTokenChange,
}: ProviderSelectorProps) {
  const meta = PROVIDERS.find(p => p.value === provider)!;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">⚡</div>
        <h2 className="card-title">AI Provider</h2>
      </div>

      {/* ── Provider icon grid ── */}
      <div className="provider-grid">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            onClick={() => onProviderChange(p.value)}
            className={`provider-card ${provider === p.value ? 'active' : ''}`}
          >
            <span className="provider-card-icon">{p.icon}</span>
            <span className="provider-card-label">{p.label}</span>
            <span className={`badge ${p.badgeClass}`}>{p.badge}</span>
          </button>
        ))}
      </div>

      {/* ── Selected provider tagline ── */}
      <p className="provider-tagline">
        <strong>{meta.icon} {meta.label}</strong> · {meta.tagline}
      </p>

      {/* ── Per-provider config ── */}
      <div className="key-fields">

        {/* ── Claude / Anthropic ── */}
        {provider === 'anthropic' && (
          <>
            <KeyField
              id="anthropic-key"
              label="Anthropic API Key"
              placeholder="sk-ant-api03-..."
              value={anthropicKey}
              onChange={onAnthropicKeyChange}
              docs={PROVIDERS.find(p => p.value === 'anthropic')!.keyDocs!}
              provider="anthropic"
            />
            <ModelPicker
              provider="anthropic"
              apiKey={anthropicKey}
              selectedModel={anthropicModel}
              onModelChange={onAnthropicModelChange}
              placeholder="claude-sonnet-4-6"
            />
          </>
        )}

        {/* ── OpenAI ── */}
        {provider === 'openai' && (
          <>
            <KeyField
              id="openai-key"
              label="OpenAI API Key"
              placeholder="sk-proj-..."
              value={openaiKey}
              onChange={onOpenaiKeyChange}
              docs={PROVIDERS.find(p => p.value === 'openai')!.keyDocs!}
              provider="openai"
            />
            <ModelPicker
              provider="openai"
              apiKey={openaiKey}
              selectedModel={openaiModel}
              onModelChange={onOpenaiModelChange}
              placeholder="gpt-4o"
            />
          </>
        )}

        {/* ── OpenRouter ── */}
        {provider === 'openrouter' && (
          <>
            <KeyField
              id="openrouter-key"
              label="OpenRouter API Key"
              placeholder="sk-or-v1-..."
              value={openrouterKey}
              onChange={onOpenrouterKeyChange}
              docs={PROVIDERS.find(p => p.value === 'openrouter')!.keyDocs!}
              provider="openrouter"
            />
            <ModelPicker
              provider="openrouter"
              openrouterKey={openrouterKey}
              selectedModel={openrouterModel}
              onModelChange={onOpenrouterModelChange}
              placeholder="google/gemma-3-27b-it:free"
            />
            <p className="ollama-note" style={{ marginTop: '8px' }}>
              💡 Free models are rate-limited but great for testing — no billing needed.
            </p>
          </>
        )}

        {/* ── Ollama (Local) ── */}
        {provider === 'ollama' && (
          <>
            <p className="ollama-note">
              🖥️ Ollama runs locally — no API key needed. Ensure Ollama is running at{' '}
              <code>localhost:11434</code>.
            </p>
            <ModelPicker
              provider="ollama"
              selectedModel={ollamaModel}
              onModelChange={onOllamaModelChange}
              placeholder="llama3 (or click Fetch models)"
            />
          </>
        )}
      </div>

      {/* ── Dropbox ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
        <DropboxField dropboxToken={dropboxToken} onDropboxTokenChange={onDropboxTokenChange} />
      </div>

      <p className="key-security-note">
        🔒 Keys stored in session only · Never logged or sent to third parties
      </p>
    </div>
  );
}
