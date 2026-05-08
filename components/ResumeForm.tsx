'use client';

import { LLMProvider } from '@/types';
import { Loader2, Sparkles, FileText, Briefcase, Building2 } from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import { ResumeUploader } from './ResumeUploader';
import { MAX_RESUME_CHARS, MAX_JD_CHARS, RESUME_WARN_CHARS, JD_WARN_CHARS } from '@/lib/constants';

interface ResumeFormProps {
  resume: string;
  jobDescription: string;
  companyName: string;
  provider: LLMProvider;
  anthropicKey: string;
  openaiKey: string;
  openrouterKey: string;
  anthropicModel: string;
  openaiModel: string;
  ollamaModel: string;
  openrouterModel: string;
  isLoading: boolean;
  /** When true the provider selector is disabled — prevents mid-session provider switch */
  providerLocked?: boolean;
  onResumeChange: (v: string) => void;
  onJobDescriptionChange: (v: string) => void;
  onCompanyNameChange: (v: string) => void;
  onProviderChange: (p: LLMProvider) => void;
  onAnthropicKeyChange:     (k: string) => void;
  onOpenaiKeyChange:        (k: string) => void;
  onOpenrouterKeyChange:    (k: string) => void;
  onAnthropicModelChange:   (m: string) => void;
  onOpenaiModelChange:      (m: string) => void;
  onOllamaModelChange:      (m: string) => void;
  onOpenrouterModelChange:  (m: string) => void;
  dropboxToken: string;
  onDropboxTokenChange: (k: string) => void;
  onSubmit: () => void;
}

export function ResumeForm({
  resume, jobDescription, companyName,
  provider, anthropicKey, openaiKey, openrouterKey,
  anthropicModel, openaiModel, ollamaModel, openrouterModel,
  isLoading,
  providerLocked = false,
  onResumeChange, onJobDescriptionChange, onCompanyNameChange,
  onProviderChange,
  onAnthropicKeyChange, onOpenaiKeyChange, onOpenrouterKeyChange,
  onAnthropicModelChange, onOpenaiModelChange, onOllamaModelChange, onOpenrouterModelChange,
  dropboxToken, onDropboxTokenChange,
  onSubmit,
}: ResumeFormProps) {
  const hasKey =
    provider === 'ollama' ||
    anthropicKey.trim().length > 0 ||
    openaiKey.trim().length > 0 ||
    openrouterKey.trim().length > 0;

  // Derive char-count status for colour coding
  const resumeStatus =
    resume.length > MAX_RESUME_CHARS ? 'over' :
    resume.length > RESUME_WARN_CHARS ? 'warn' : 'ok';

  const jdStatus =
    jobDescription.length > MAX_JD_CHARS ? 'over' :
    jobDescription.length > JD_WARN_CHARS ? 'warn' : 'ok';

  const resumeOverLimit = resume.length > MAX_RESUME_CHARS;
  const jdOverLimit     = jobDescription.length > MAX_JD_CHARS;

  const canSubmit =
    resume.trim().length > 0 &&
    jobDescription.trim().length > 0 &&
    !resumeOverLimit &&
    !jdOverLimit &&
    hasKey &&
    !isLoading;

  return (
    <div className="form-panel">
      {/* Provider selector — locked after generation to prevent mid-session switch */}
      <div className={`provider-lock-wrapper ${providerLocked ? 'provider-locked' : ''}`}>
        <ProviderSelector
          provider={provider}
          anthropicKey={anthropicKey}
          openaiKey={openaiKey}
          openrouterKey={openrouterKey}
          anthropicModel={anthropicModel}
          openaiModel={openaiModel}
          ollamaModel={ollamaModel}
          openrouterModel={openrouterModel}
          onProviderChange={onProviderChange}
          onAnthropicKeyChange={onAnthropicKeyChange}
          onOpenaiKeyChange={onOpenaiKeyChange}
          onOpenrouterKeyChange={onOpenrouterKeyChange}
          onAnthropicModelChange={onAnthropicModelChange}
          onOpenaiModelChange={onOpenaiModelChange}
          onOllamaModelChange={onOllamaModelChange}
          onOpenrouterModelChange={onOpenrouterModelChange}
          dropboxToken={dropboxToken}
          onDropboxTokenChange={onDropboxTokenChange}
        />
        {providerLocked && (
          <div className="provider-lock-overlay" title="Provider is locked for this session. Generate a new resume to switch providers.">
            <span className="provider-lock-badge">🔒 Locked for this session</span>
          </div>
        )}
      </div>

      {/* Base Resume */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon"><FileText size={16} /></div>
          <div className="card-title-group">
            <h2 className="card-title">Your Resume</h2>
            <span className="persist-badge">💾 Auto-saved</span>
          </div>
        </div>
        <ResumeUploader onExtracted={(text) => onResumeChange(text)} />
        <div className="resume-divider"><span>or paste manually</span></div>
        <textarea
          id="resume-input"
          className="textarea"
          rows={12}
          placeholder={"Paste your full resume here…\n\nInclude work experience, education, skills, certifications, and contact info."}
          value={resume}
          onChange={(e) => onResumeChange(e.target.value)}
          spellCheck={false}
        />
        <div className={`char-count char-count--${resumeStatus}`}>
          {resume.length.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} chars
          {resumeStatus === 'warn' && <span className="char-count-label"> · approaching limit</span>}
          {resumeStatus === 'over' && <span className="char-count-label"> · exceeds limit — generation blocked</span>}
        </div>
      </div>

      {/* Job Description */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon"><Briefcase size={16} /></div>
          <h2 className="card-title">Job Description</h2>
        </div>
        <label className="field-label" htmlFor="jd-input">
          Paste the full JD — clears after generation
        </label>
        <textarea
          id="jd-input"
          className="textarea"
          rows={12}
          placeholder={"Paste the full job description here…\n\nInclude responsibilities, requirements, and preferred qualifications."}
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          spellCheck={false}
        />
        <div className={`char-count char-count--${jdStatus}`}>
          {jobDescription.length.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()} chars
          {jdStatus === 'warn' && <span className="char-count-label"> · approaching limit</span>}
          {jdStatus === 'over' && <span className="char-count-label"> · exceeds limit — generation blocked</span>}
        </div>
      </div>

      {/* Company Name */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon"><Building2 size={16} /></div>
          <h2 className="card-title">
            Company Name <span className="optional-label">(optional)</span>
          </h2>
        </div>
        <input
          id="company-input"
          type="text"
          className="text-input"
          placeholder="e.g. Google, Stripe, OpenAI…"
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
        />
      </div>

      {/* Generate */}
      <button
        id="generate-btn"
        className={`generate-btn ${canSubmit ? 'active' : 'disabled'}`}
        onClick={onSubmit}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <><Loader2 size={20} className="spin" /><span>Analyzing JD and tailoring your resume…</span></>
        ) : (
          <><Sparkles size={20} /><span>Generate Tailored Resume</span></>
        )}
      </button>
    </div>
  );
}
