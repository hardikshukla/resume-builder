'use client';

import { useState, useEffect, useCallback } from 'react';
import { LLMProvider, ResumeBuilderOutput } from '@/types';
import { ResumeForm } from '@/components/ResumeForm';
import { OutputPanel } from '@/components/OutputPanel';
import { Sparkles, ExternalLink } from 'lucide-react';

// ── sessionStorage keys ───────────────────────────────────────────────────────
const S = {
  provider:        'rb_provider',
  anthropicKey:    'rb_apikey_anthropic',
  openaiKey:       'rb_apikey_openai',
  anthropicModel:  'rb_model_anthropic',
  openaiModel:     'rb_model_openai',
  ollamaModel:     'rb_model_ollama',
};
const LOCAL_RESUME = 'rb_resume';

type GenerationResult = {
  result: ResumeBuilderOutput;
  providerUsed: string;
  fallbackOccurred: boolean;
  fallbackReason?: string;
};

export default function Home() {
  const [resume,         setResume]         = useState('');
  const [jobDescription, setJD]             = useState('');
  const [companyName,    setCompany]        = useState('');
  const [provider,       setProvider]       = useState<LLMProvider>('anthropic');
  const [anthropicKey,   setAnthropicKey]   = useState('');
  const [openaiKey,      setOpenaiKey]      = useState('');
  const [anthropicModel, setAnthropicModel] = useState('');
  const [openaiModel,    setOpenaiModel]    = useState('');
  const [ollamaModel,    setOllamaModel]    = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [isRefining,     setIsRefining]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [refineError,    setRefineError]    = useState<string | null>(null);
  const [output,         setOutput]         = useState<GenerationResult | null>(null);
  // originalOutput is locked after generation and NEVER modified by refine.
  // Every refine call uses it as the base so results are always predictable.
  const [originalOutput, setOriginalOutput] = useState<GenerationResult | null>(null);
  const [hasRefined,     setHasRefined]     = useState(false);
  // Which recommendation strings are currently reflected in the refined resume.
  // Cleared when the user reverts; replaced on every new refine call.
  const [appliedRecs,    setAppliedRecs]    = useState<string[]>([]);

  // Restore from storage on mount
  useEffect(() => {
    const ss = (k: string) => sessionStorage.getItem(k) ?? '';
    setResume(localStorage.getItem(LOCAL_RESUME) ?? '');
    const p = ss(S.provider) as LLMProvider;
    if (p) setProvider(p);
    setAnthropicKey(ss(S.anthropicKey));
    setOpenaiKey(ss(S.openaiKey));
    setAnthropicModel(ss(S.anthropicModel));
    setOpenaiModel(ss(S.openaiModel));
    setOllamaModel(ss(S.ollamaModel));
  }, []);

  // Helpers — persist on change
  const handleResumeChange = useCallback((v: string) => {
    setResume(v); localStorage.setItem(LOCAL_RESUME, v);
  }, []);

  const handleProviderChange = useCallback((p: LLMProvider) => {
    setProvider(p); sessionStorage.setItem(S.provider, p);
  }, []);

  // Stable persist handlers — useCallback prevents ResumeForm from re-rendering
  // on every parent state change due to new function references.
  const handleAnthropicKeyChange = useCallback((v: string) => {
    setAnthropicKey(v); sessionStorage.setItem(S.anthropicKey, v);
  }, []);

  const handleOpenaiKeyChange = useCallback((v: string) => {
    setOpenaiKey(v); sessionStorage.setItem(S.openaiKey, v);
  }, []);

  const handleAnthropicModelChange = useCallback((v: string) => {
    setAnthropicModel(v); sessionStorage.setItem(S.anthropicModel, v);
  }, []);

  const handleOpenaiModelChange = useCallback((v: string) => {
    setOpenaiModel(v); sessionStorage.setItem(S.openaiModel, v);
  }, []);

  const handleOllamaModelChange = useCallback((v: string) => {
    setOllamaModel(v); sessionStorage.setItem(S.ollamaModel, v);
  }, []);


  async function handleGenerate() {
    setIsLoading(true);
    setError(null);
    setOutput(null);
    setOriginalOutput(null);
    setHasRefined(false);
    setAppliedRecs([]);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume,
          jobDescription,
          companyName: companyName || undefined,
          provider,
          anthropicKey:   anthropicKey   || undefined,
          openaiKey:      openaiKey      || undefined,
          anthropicModel: anthropicModel || undefined,
          openaiModel:    openaiModel    || undefined,
          ollamaModel:    ollamaModel    || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Generation failed');

      setOutput(json.data);
      setOriginalOutput(json.data); // lock the original — never overwritten by refine
      setJD('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefine(selectedRecs: string[]) {
    // Always refines from the ORIGINAL output — never chains on top of a previous refine.
    // This means deselecting a recommendation and re-applying gives a clean result
    // with only the currently-selected items, with no residue from previous runs.
    if (!originalOutput) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentOutput:           originalOutput.result, // ← always the original
          selectedRecommendations: selectedRecs,
          provider,
          anthropicKey:   anthropicKey   || undefined,
          openaiKey:      openaiKey      || undefined,
          anthropicModel: anthropicModel || undefined,
          openaiModel:    openaiModel    || undefined,
          ollamaModel:    ollamaModel    || undefined,
        }),
      });
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
  }

  // Revert to original — zero tokens, zero API calls, instant.
  function handleRevert() {
    if (originalOutput) {
      setOutput(originalOutput);
      setHasRefined(false);
      setAppliedRecs([]); // nothing applied after reverting to original
    }
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon"><Sparkles size={22} /></div>
            <div>
              <h1 className="brand-name">Resume Builder</h1>
              <p className="brand-tagline">AI-powered · ATS-optimized · Tailored to every JD</p>
            </div>
          </div>
          <div className="header-meta">
            <span className="version-badge">v1.0</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              className="github-link" aria-label="View on GitHub">
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="left-panel" aria-label="Resume inputs">
          <ResumeForm
            resume={resume}
            jobDescription={jobDescription}
            companyName={companyName}
            provider={provider}
            anthropicKey={anthropicKey}
            openaiKey={openaiKey}
            anthropicModel={anthropicModel}
            openaiModel={openaiModel}
            ollamaModel={ollamaModel}
            isLoading={isLoading}
            onResumeChange={handleResumeChange}
            onJobDescriptionChange={setJD}
            onCompanyNameChange={setCompany}
            onProviderChange={handleProviderChange}
            onAnthropicKeyChange={handleAnthropicKeyChange}
            onOpenaiKeyChange={handleOpenaiKeyChange}
            onAnthropicModelChange={handleAnthropicModelChange}
            onOpenaiModelChange={handleOpenaiModelChange}
            onOllamaModelChange={handleOllamaModelChange}
            onSubmit={handleGenerate}
          />
        </section>

        <section className="right-panel" aria-label="Generated output">
          {(isLoading || isRefining) && (
            <div className="loading-state">
              <div className="loading-orb" />
              {isLoading ? (
                <>
                  <p className="loading-text">Analyzing JD and tailoring your resume…</p>
                  <p className="loading-sub">This may take 1-3 minutes depending on resume length</p>
                </>
              ) : (
                <>
                  <p className="loading-text">Applying selected improvements…</p>
                  <p className="loading-sub">Usually 15–30 seconds</p>
                </>
              )}
            </div>
          )}

          {(error || refineError) && !isLoading && !isRefining && (
            <div className="error-card" role="alert">
              <div className="error-icon">❌</div>
              <div>
                <strong>{refineError ? 'Refine failed' : 'Generation failed'}</strong>
                <p className="error-msg">{error || refineError}</p>
              </div>
            </div>
          )}

          {!isLoading && !error && !output && (
            <div className="empty-state">
              <div className="empty-icon">✨</div>
              <h2 className="empty-title">Your tailored resume will appear here</h2>
              <p className="empty-sub">
                Fill in your resume and a job description, then click{' '}
                <strong>Generate Tailored Resume</strong>.
              </p>
              <div className="empty-features">
                <div className="feature-pill">🎯 ATS Match Score</div>
                <div className="feature-pill">📊 Gap Analysis</div>
                <div className="feature-pill">📄 Tailored Resume</div>
                <div className="feature-pill">✉️ Cover Letter</div>
                <div className="feature-pill">📥 .docx Download</div>
              </div>
            </div>
          )}

          {output && !isLoading && (
            <OutputPanel
              data={output}
              companyName={companyName || undefined}
              onRefine={handleRefine}
              isRefining={isRefining}
              hasRefined={hasRefined}
              appliedRecs={appliedRecs}
              originalMatchScore={originalOutput?.result.gapAnalysis.matchScore}
              originalResume={originalOutput?.result.resume}
              originalCoverLetter={originalOutput?.result.coverLetter}
              onRevert={handleRevert}
            />
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>API keys stored in session only · Never logged or persisted server-side</p>
      </footer>
    </div>
  );
}
