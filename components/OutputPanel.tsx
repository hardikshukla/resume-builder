'use client';

import { CoverLetterData, ResumeBuilderOutput, ResumeData } from '@/types';
import { DownloadButton } from './DownloadButton';
import { CloudSyncButton } from './output-panel/CloudSyncButton';
import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
} from 'lucide-react';

interface OutputPanelProps {
  data: {
    result: ResumeBuilderOutput;
    providerUsed: string;
    fallbackOccurred: boolean;
    fallbackReason?: string;
  };
  companyName?: string;
  onRefine: (selectedRecs: string[]) => void;
  isRefining: boolean;
  hasRefined: boolean;
  appliedRecs: string[];        // recommendations currently in the refined resume
  originalMatchScore?: number;
  originalResume?: ResumeData;
  originalCoverLetter?: CoverLetterData;
  onRevert: () => void;
  dropboxToken: string;
  skipDropboxPrompt: boolean;
  setSkipDropboxPrompt: (v: boolean) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// (String utils moved to @/lib/utils/string)

// ── Cloud Sync Button (client-side upload — token never leaves the browser) ───

import { ViewToggle } from './output-panel/ViewToggle';
import { ScoreBadge } from './output-panel/ScoreBadge';
import { CollapsibleSection } from './output-panel/CollapsibleSection';

// ── ATS Optimization Summary (what the AI already did) ───────────────────────
import { ATSOptimizationSummary } from './output-panel/ATSOptimizationSummary';
import { MissingKeywordsPanel } from './output-panel/MissingKeywordsPanel';
import { RefineableRecommendations } from './output-panel/RefineableRecommendations';
import { ResumePreview } from './output-panel/ResumePreview';

export function OutputPanel({
  data, companyName, onRefine, isRefining,
  hasRefined, appliedRecs, originalMatchScore, originalResume, originalCoverLetter, onRevert,
  dropboxToken, skipDropboxPrompt, setSkipDropboxPrompt
}: OutputPanelProps) {
  const { result, providerUsed, fallbackOccurred, fallbackReason } = data;
  const { gapAnalysis, resume, coverLetter } = result;

  // Independent view toggles for Resume and Cover Letter cards
  const [resumeView,      setResumeView]      = useState<'original' | 'updated'>('updated');
  const [coverLetterView, setCoverLetterView] = useState<'original' | 'updated'>('updated');

  // Active content to render
  const activeResume      = resumeView === 'original'      && originalResume      ? originalResume      : resume;
  const activeCoverLetter = coverLetterView === 'original' && originalCoverLetter ? originalCoverLetter : coverLetter;
  // Active result for download (reflects the card's current toggle)
  const resumeDownloadData      = { ...result, resume:      activeResume };
  const coverLetterDownloadData = { ...result, coverLetter: activeCoverLetter ?? { subject: '', body: '' } };

  // Fallback: trigger both standard server-side downloads without going through Dropbox
  const handleLocalDownload = async () => {
    const doDownload = async (type: 'resume' | 'coverLetter', data: typeof result, name: string) => {
      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, data, companyName }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const match = disposition.match(/filename="(.+?)"/);
        const filename = match?.[1] ?? name;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } catch { /* silent — network errors */ }
    };
    await doDownload('resume',      resumeDownloadData,      'resume.docx');
    await doDownload('coverLetter', coverLetterDownloadData, 'coverLetter.docx');
  };

  return (
    <div className="output-panel">
      {/* Revert banner — shown only after a refine has been applied */}
      {hasRefined && (
        <div className="revert-banner" role="alert">
          <div className="revert-banner-text">
            <RotateCcw size={14} />
            <span>
              Viewing refined version
              {originalMatchScore != null && originalMatchScore !== gapAnalysis.matchScore && (
                <> · Score: <span className="revert-score-before">{originalMatchScore}%</span>
                {' → '}<span className="revert-score-after">{gapAnalysis.matchScore}%</span></>
              )}
            </span>
          </div>
          <button className="revert-btn" onClick={onRevert}>
            Revert to Original
          </button>
        </div>
      )}
      {fallbackOccurred && (
        <div className="fallback-banner" role="alert">
          <span className="fallback-icon">⚠️</span>
          <div>
            <strong>Fallback provider used:</strong> {fallbackReason}
            <br />
            <small>Used: {providerUsed}</small>
          </div>
        </div>
      )}

      {/* Keyword Coverage card */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon">🎯</div>
          <h2 className="card-title">Keyword Coverage</h2>
          <span className="provider-tag">via {providerUsed}</span>
        </div>
        <ScoreBadge score={gapAnalysis.matchScore} />
        <p className="score-disclaimer">
          Based on keyword frequency against the JD &mdash; not a recruiter&apos;s judgment.
          Scores above 70% indicate strong keyword alignment.
        </p>

        <div className="gap-sections">
          <CollapsibleSection
            icon={<CheckCircle2 size={16} />}
            title="Strong Matches"
            items={gapAnalysis.strongMatches}
            className="section-green"
            defaultOpen
          />
          <CollapsibleSection
            icon={<AlertTriangle size={16} />}
            title="Gaps"
            items={gapAnalysis.gaps}
            className="section-yellow"
            defaultOpen
          />
          <CollapsibleSection
            icon={<XCircle size={16} />}
            title="Dealbreakers"
            items={gapAnalysis.dealbreakers}
            className="section-red"
            defaultOpen
          />
          <RefineableRecommendations
            recommendations={gapAnalysis.recommendations}
            appliedRecs={appliedRecs}
            onRefine={onRefine}
            isRefining={isRefining}
          />
          <MissingKeywordsPanel
            missingKeywords={gapAnalysis.missingKeywords ?? []}
            onRefine={onRefine}
            isRefining={isRefining}
          />
          <ATSOptimizationSummary gapAnalysis={gapAnalysis} />
        </div>
      </div>

      {/* Resume Preview */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon">📄</div>
          <h2 className="card-title">Tailored Resume Preview</h2>
          {hasRefined && originalResume && (
            <ViewToggle view={resumeView} onChange={(v) => { setResumeView(v); }} />
          )}
        </div>
        <ResumePreview resume={activeResume} />
        <div className="download-row">
          <DownloadButton type="resume" data={resumeDownloadData} companyName={companyName} />
          <CloudSyncButton 
            data={result} 
            companyName={companyName} 
            dropboxToken={dropboxToken} 
            skipDropboxPrompt={skipDropboxPrompt} 
            setSkipDropboxPrompt={setSkipDropboxPrompt}
            onLocalDownload={handleLocalDownload}
          />
        </div>
      </div>

      {/* Cover Letter Preview */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon">✉️</div>
          <h2 className="card-title">Cover Letter</h2>
          {hasRefined && originalCoverLetter && (
            <ViewToggle view={coverLetterView} onChange={(v) => { setCoverLetterView(v); }} />
          )}
        </div>
        {activeCoverLetter ? (
          <>
            <div className="cover-preview">
              <div className="cover-subject">Re: {activeCoverLetter.subject}</div>
              <div className="cover-body">
                {activeCoverLetter.body.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
            <div className="download-row">
              <DownloadButton
                type="coverLetter"
                data={coverLetterDownloadData}
                companyName={companyName}
              />
            </div>
          </>
        ) : (
          <div className="cover-missing-notice">
            ⚠️ Cover letter was not generated this time (the resume was too long for one pass).
            Use <strong>Apply &amp; Refine</strong> with a recommendation selected to generate it.
          </div>
        )}
      </div>
    </div>
  );
}
