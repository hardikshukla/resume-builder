'use client';

import { useProviderConfig } from '@/hooks/useProviderConfig';
import { useGenerate }       from '@/hooks/useGenerate';
import { useRefine }         from '@/hooks/useRefine';
import { ResumeForm }        from '@/components/ResumeForm';
import { OutputPanel }       from '@/components/OutputPanel';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { Sparkles, ExternalLink, Lock } from 'lucide-react';
import { useState } from 'react';

export default function Home() {
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  useInactivityTimeout(20, () => {
    sessionStorage.clear();
    setIsSessionExpired(true);
  });

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const config = useProviderConfig();

  const {
    resume, jobDescription, companyName,
    setJD, setCompany,
    handleResumeChange,
    output, originalOutput,
    isLoading, error,
    handleGenerate, setOutput, restoreOriginal,
  } = useGenerate(config);

  const {
    isRefining, refineError,
    hasRefined, appliedRecs,
    handleRefine, handleRevert,
  } = useRefine(originalOutput, setOutput, restoreOriginal, config);

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <a
              href="https://github.com/hardikshukla/resume-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
              aria-label="View on GitHub"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* ── Left panel: inputs ─────────────────────────────────────────── */}
        <section className="left-panel" aria-label="Resume inputs">
          <ResumeForm
            resume={resume}
            jobDescription={jobDescription}
            companyName={companyName}
            provider={config.provider}
            anthropicKey={config.anthropicKey}
            openaiKey={config.openaiKey}
            anthropicModel={config.anthropicModel}
            openaiModel={config.openaiModel}
            ollamaModel={config.ollamaModel}
            isLoading={isLoading}
            providerLocked={config.isLocked}
            onResumeChange={handleResumeChange}
            onJobDescriptionChange={setJD}
            onCompanyNameChange={setCompany}
            onProviderChange={config.setProvider}
            onAnthropicKeyChange={config.setAnthropicKey}
            onOpenaiKeyChange={config.setOpenaiKey}
            onAnthropicModelChange={config.setAnthropicModel}
            onOpenaiModelChange={config.setOpenaiModel}
            onOllamaModelChange={config.setOllamaModel}
            dropboxToken={config.dropboxToken}
            onDropboxTokenChange={config.setDropboxToken}
            onSubmit={handleGenerate}
          />
        </section>

        {/* ── Right panel: output ────────────────────────────────────────── */}
        <section className="right-panel" aria-label="Generated output">
          {/* Loading state */}
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

          {/* Error state */}
          {(error || refineError) && !isLoading && !isRefining && (
            <div className="error-card" role="alert">
              <div className="error-icon">❌</div>
              <div>
                <strong>{refineError ? 'Refine failed' : 'Generation failed'}</strong>
                <p className="error-msg">{error || refineError}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && !output && (
            <div className="empty-state">
              <div className="empty-icon">✨</div>
              <h2 className="empty-title">Your tailored resume will appear here</h2>
              <p className="empty-sub">
                Fill in your resume and a job description, then click{' '}
                <strong>Generate Tailored Resume</strong>.
              </p>
              <div className="empty-features">
                <div className="feature-pill">🎯 Keyword Coverage</div>
                <div className="feature-pill">📊 Gap Analysis</div>
                <div className="feature-pill">📄 Tailored Resume</div>
                <div className="feature-pill">✉️ Cover Letter</div>
                <div className="feature-pill">📥 .docx Download</div>
              </div>
            </div>
          )}

          {/* Output */}
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
              dropboxToken={config.dropboxToken}
              skipDropboxPrompt={config.skipDropboxPrompt}
              setSkipDropboxPrompt={config.setSkipDropboxPrompt}
            />
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>API keys stored in session only · Never logged or persisted server-side</p>
      </footer>

      {isSessionExpired && (
        <div className="session-expired-overlay">
          <div className="session-expired-modal card">
            <div className="card-icon"><Lock size={32} /></div>
            <h2>Session Expired</h2>
            <p>
              For your security, your session was closed due to 20 minutes of inactivity. 
              Your API keys and data have been safely wiped from memory.
            </p>
            <button className="generate-btn active" onClick={() => window.location.reload()} style={{ marginTop: '20px' }}>
              Start New Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
