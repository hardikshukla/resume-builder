'use client';

import { CoverLetterData, GapAnalysis, MissingKeyword, ResumeBuilderOutput, ResumeData } from '@/types';
import { DownloadButton } from './DownloadButton';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Zap,
  Wand2,
  FileSearch,
  Tag,
  FileText,
  RotateCcw,
  Plus,
  Cloud,
  Loader2,
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
function toCamelCase(str: string): string {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}
function toPascalCase(str: string): string {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}
function sanitizeFilename(raw: string): string {
  return raw.replace(/\.\./g, '').replace(/[/\\]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '').replace(/[^\w\s\-().+]/g, '')
    .replace(/\s+/g, '_').slice(0, 80) || 'document';
}
function getTimestampStr() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const full = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return { date, full };
}

// ── Cloud Sync Button (client-side upload — token never leaves the browser) ───
function CloudSyncButton({
  data,
  companyName,
  dropboxToken,
  skipDropboxPrompt,
  setSkipDropboxPrompt,
  onLocalDownload,
}: {
  data: ResumeBuilderOutput;
  companyName?: string;
  dropboxToken: string;
  skipDropboxPrompt: boolean;
  setSkipDropboxPrompt: (v: boolean) => void;
  /** Called to fall back to local download when user declines Dropbox */
  onLocalDownload: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track checkbox in the modal without closing it prematurely
  const [pendingSkip, setPendingSkip] = useState(skipDropboxPrompt);

  // Sync pendingSkip whenever the modal is opened
  useEffect(() => { if (showPrompt) setPendingSkip(skipDropboxPrompt); }, [showPrompt, skipDropboxPrompt]);

  const uploadToDropbox = async (blob: Blob, path: string) => {
    const dbxArgs = { path, mode: 'add', autorename: true, mute: false, strict_conflict: false };
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dropboxToken}`,
        'Dropbox-API-Arg': JSON.stringify(dbxArgs),
        'Content-Type': 'application/octet-stream',
      },
      body: await blob.arrayBuffer(),
    });
    if (!res.ok) {
      let errMsg = `Dropbox API error: ${res.status}`;
      try { const j = await res.json(); errMsg = j.error_summary || errMsg; } catch { /* ignore */ }
      throw new Error(errMsg);
    }
  };

  const handleSync = async () => {
    if (!dropboxToken) {
      if (skipDropboxPrompt) { onLocalDownload(); } else { setShowPrompt(true); }
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { resume, coverLetter, gapAnalysis } = data;
      const rawCompany = companyName?.trim() || gapAnalysis.extractedCompanyName?.trim();
      const ts = getTimestampStr();
      const folderPath = rawCompany
        ? `/resumeBuilder/${toCamelCase(rawCompany)}`
        : `/resumeBuilder/general/${ts.date}`;
      const baseName = toCamelCase(resume.name || 'candidate');
      const companySuffix = rawCompany ? `+${toPascalCase(rawCompany)}` : '';
      const resumeFilename  = sanitizeFilename(`${baseName}Resume${companySuffix}_${ts.full}`) + '.docx';
      const coverFilename   = sanitizeFilename(`${baseName}CoverLetter${companySuffix}_${ts.full}`) + '.docx';

      // Generate entirely in-browser — token never leaves the client
      const resumeBlob = await generateResumeDOCX(resume);

      // Upload resume; cover letter only if it was generated
      const uploads: Promise<void>[] = [
        uploadToDropbox(resumeBlob, `${folderPath}/${resumeFilename}`),
      ];
      if (coverLetter) {
        const coverBlob = await generateCoverLetterDOCX(coverLetter, resume, rawCompany);
        uploads.push(uploadToDropbox(coverBlob, `${folderPath}/${coverFilename}`));
      }
      await Promise.all(uploads);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="download-btn-wrap" style={{ marginLeft: '12px' }}>
      <button
        className="download-btn cloud-sync-btn"
        onClick={handleSync}
        disabled={loading}
        style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
      >
        {loading ? <Loader2 size={16} className="spin" /> : success ? <CheckCircle2 size={16} /> : <Cloud size={16} />}
        {loading ? 'Saving…' : success ? 'Saved to Dropbox!' : 'Save All to Dropbox'}
      </button>
      {error && <p className="download-error">{error}</p>}

      {showPrompt && (
        <div className="modal-overlay">
          <div className="card prompt-modal">
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Save to Dropbox?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              To auto-sync your Resume and Cover Letter, add a Dropbox Access Token in the
              AI Provider settings panel. Files upload directly from your browser — the token
              never leaves your device.
            </p>
            <label className="refine-label" style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="checkbox"
                defaultChecked={pendingSkip}
                onChange={(e) => setPendingSkip(e.target.checked)}
              />
              <span style={{ fontSize: '13px' }}>Don’t ask me again — I prefer local downloads</span>
            </label>
            <div className="refine-action-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button className="view-toggle-btn" onClick={() => setShowPrompt(false)}>Cancel</button>
              <button className="refine-btn" onClick={() => {
                setSkipDropboxPrompt(pendingSkip);
                setShowPrompt(false);
                onLocalDownload();
              }}>Download Locally</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View Toggle (Original | Updated) ────────────────────────────────────────────
function ViewToggle({
  view,
  onChange,
}: {
  view: 'original' | 'updated';
  onChange: (v: 'original' | 'updated') => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Resume version">
      <button
        className={`view-toggle-btn ${view === 'original' ? 'view-toggle-active' : ''}`}
        onClick={() => onChange('original')}
      >
        Original
      </button>
      <button
        className={`view-toggle-btn ${view === 'updated' ? 'view-toggle-active' : ''}`}
        onClick={() => onChange('updated')}
      >
        Updated
      </button>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? 'score-green' : score >= 50 ? 'score-yellow' : 'score-red';
  const label =
    score >= 70 ? 'Strong Match' : score >= 50 ? 'Partial Match' : 'Weak Match';

  return (
    <div className={`score-badge ${color}`}>
      <div className="score-number">{score}%</div>
      <div className="score-label">{label}</div>
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function CollapsibleSection({
  icon, title, items, className, defaultOpen = false,
}: {
  icon: React.ReactNode; title: string; items: string[];
  className: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div className={`collapsible ${className} ${open ? 'open' : ''}`}>
      <button className="collapsible-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="collapsible-icon">{icon}</span>
        <span className="collapsible-title">{title}</span>
        <span className="collapsible-count">{items.length}</span>
        <span className="collapsible-chevron">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <ul className="collapsible-body">
          {items.map((item, i) => <li key={i} className="collapsible-item">{item}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── ATS Optimization Summary (what the AI already did) ───────────────────────
function ATSOptimizationSummary({ gapAnalysis }: { gapAnalysis: GapAnalysis }) {
  const [open, setOpen] = useState(false);

  const hasContent =
    (gapAnalysis.keywordsAdded?.length ?? 0) > 0 || !!gapAnalysis.summaryChanges;

  if (!hasContent) return null;

  return (
    <div className={`collapsible section-purple ${open ? 'open' : ''}`}>
      <button
        className="collapsible-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-icon"><FileSearch size={16} /></span>
        <span className="collapsible-title">ATS Optimization Summary</span>
        <span className="collapsible-count">{gapAnalysis.keywordsAdded?.length ?? 0}</span>
        <span className="collapsible-chevron">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="ats-summary-body">
          {gapAnalysis.summaryChanges && (
            <div className="ats-summary-row">
              <span className="ats-summary-icon"><FileText size={13} /></span>
              <div>
                <span className="ats-summary-label">Summary rewrite: </span>
                <span className="ats-summary-text">{gapAnalysis.summaryChanges}</span>
              </div>
            </div>
          )}
          {gapAnalysis.keywordsAdded?.length > 0 && (
            <div className="ats-summary-group">
              <div className="ats-summary-group-label">
                <Tag size={13} />
                Keywords added (implied → explicit)
              </div>
              <ul className="collapsible-body">
                {gapAnalysis.keywordsAdded.map((kw, i) => (
                  <li key={i} className="collapsible-item ats-item-green">{kw}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Missing Keywords Panel ─────────────────────────────────────────────────────
// Shows keywords the AI flagged as MISSING. User selects the ones they actually
// have experience with, optionally adds context, then applies from original.
function MissingKeywordsPanel({
  missingKeywords,
  onRefine,
  isRefining,
}: {
  missingKeywords: MissingKeyword[];
  onRefine: (recs: string[]) => void;
  isRefining: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});

  if (!missingKeywords || missingKeywords.length === 0) return null;

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); } else { next.add(i); }
      return next;
    });

  const handleApply = () => {
    const recs = Array.from(selected).map((i) => {
      const kw = missingKeywords[i];
      const note = notes[i]?.trim();
      return `Add "${kw.keyword}" to ${kw.suggestedSection}. Candidate confirms they have this experience.${
        note ? ` Context: ${note}.` : ''
      } Suggested bullet: "${kw.suggestedBullet}"`;
    });
    onRefine(recs);
    // Reset after apply
    setSelected(new Set());
    setNotes({});
  };

  return (
    <div className={`collapsible section-orange ${open ? 'open' : ''}`}>
      <button
        className="collapsible-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-icon"><Plus size={16} /></span>
        <span className="collapsible-title">Missing Keywords — Add Yours</span>
        <span className="collapsible-count">{missingKeywords.length}</span>
        <span className="collapsible-chevron">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="mkp-body">
          <p className="mkp-intro">
            These keywords from the JD have no evidence in your resume.
            Select the ones you <em>genuinely</em> have experience with — the resume
            will be updated from the original with only those additions.
          </p>

          <div className="mkp-cards">
            {missingKeywords.map((kw, i) => (
              <div
                key={i}
                className={`mkp-card ${selected.has(i) ? 'mkp-card-selected' : ''}`}
                onClick={() => toggle(i)}
              >
                <div className="mkp-card-top">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    onClick={(e) => e.stopPropagation()}
                    className="refine-checkbox"
                  />
                  <span className="mkp-keyword">{kw.keyword}</span>
                  <span className="mkp-section-tag">{kw.suggestedSection}</span>
                </div>
                <div className="mkp-suggestion">💡 {kw.suggestedBullet}</div>
                {selected.has(i) && (
                  <input
                    type="text"
                    className="mkp-note"
                    placeholder="Add context (optional) — e.g., '2 yrs at Company X'"
                    value={notes[i] ?? ''}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNotes((prev) => ({ ...prev, [i]: e.target.value }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            ))}
          </div>

          {selected.size > 0 && (
            <div className="refine-action-row">
              <div className="refine-action-hint">
                Only selected keywords will be added. Applied from original resume.
              </div>
              <button
                className="refine-btn"
                onClick={handleApply}
                disabled={isRefining}
              >
                {isRefining ? (
                  <><span className="refine-spinner" />Applying…</>
                ) : (
                  <><Plus size={15} />Add {selected.size} keyword{selected.size > 1 ? 's' : ''} to Resume</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RefineableRecommendations({
  recommendations,
  appliedRecs,
  onRefine,
  isRefining,
}: {
  recommendations: string[];
  appliedRecs: string[];      // which items are currently in the refined resume
  onRefine: (selected: string[]) => void;
  isRefining: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [justApplied, setJustApplied] = useState(false);
  // useRef tracks previous isRefining without triggering a re-render
  const prevIsRefining = useRef(false);

  // Build a set for O(1) lookups
  const appliedSet = new Set(appliedRecs);
  const appliedCount = recommendations.filter((r) => appliedSet.has(r)).length;

  // Reset selection when a refine completes (isRefining: true → false)
  useEffect(() => {
    if (!isRefining && prevIsRefining.current) {
      setSelected(new Set());
      setJustApplied(true);
      const timer = setTimeout(() => setJustApplied(false), 3500);
      return () => clearTimeout(timer);
    }
    prevIsRefining.current = isRefining;
  }, [isRefining]);

  if (recommendations.length === 0) return null;

  const allChecked = selected.size === recommendations.length;
  const noneChecked = selected.size === 0;

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); } else { next.add(i); }
      return next;
    });

  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(recommendations.map((_, i) => i)));

  const handleRefine = () => {
    const chosen = recommendations.filter((_, i) => selected.has(i));
    onRefine(chosen);
  };

  return (
    <div className={`collapsible section-blue ${open ? 'open' : ''}`}>
      <button className="collapsible-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="collapsible-icon"><Lightbulb size={16} /></span>
        <span className="collapsible-title">Recommendations</span>
        {/* Show applied count badge when some are applied */}
        {appliedCount > 0 ? (
          <span className="rec-applied-count">{appliedCount}/{recommendations.length} applied</span>
        ) : (
          <span className="collapsible-count">{recommendations.length}</span>
        )}
        <span className="collapsible-chevron">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {open && (
        <div className="refine-body">
          {/* Success flash */}
          {justApplied && (
            <div className="refine-applied-banner">
              ✅ Applied — resume updated. Select new items to refine again.
            </div>
          )}

          {/* Select all row */}
          <label className="refine-select-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="refine-checkbox"
            />
            <span>{allChecked ? 'Deselect all' : 'Select all'}</span>
          </label>

          {/* Individual recommendations with status badges */}
          <ul className="collapsible-body refine-list">
            {recommendations.map((rec, i) => {
              const isApplied = appliedSet.has(rec);
              const isChecked = selected.has(i);
              return (
                <li
                  key={i}
                  className={`collapsible-item refine-item ${
                    isChecked ? 'refine-checked' : ''
                  } ${isApplied ? 'rec-applied' : ''}`}
                >
                  <label className="refine-label">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(i)}
                      className="refine-checkbox"
                    />
                    <span className="rec-text">{rec}</span>
                    {isApplied ? (
                      <span className="rec-status-badge rec-status-applied">
                        <CheckCircle2 size={11} /> Applied
                      </span>
                    ) : (
                      <span className="rec-status-badge rec-status-pending">
                        Not applied
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Apply & Refine button */}
          {!noneChecked && (
            <div className="refine-action-row">
              <div className="refine-action-hint">
                Only checked items will be applied. Unchecked items are explicitly excluded.
              </div>
              <button
                className="refine-btn"
                onClick={handleRefine}
                disabled={isRefining}
              >
                {isRefining ? (
                  <><span className="refine-spinner" />Refining…</>
                ) : (
                  <><Wand2 size={15} />Apply &amp; Refine ({selected.size} of {recommendations.length} selected)</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResumePreview({ resume }: { resume: ResumeBuilderOutput['resume'] }) {
  return (
    <div className="resume-preview">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-name">{resume.name}</div>
        <div className="rp-contact">
          {[
            resume.contact.email,
            resume.contact.phone,
            resume.contact.linkedin,
            resume.contact.location,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <div className="rp-section">
          <div className="rp-section-header">
            <User size={14} />
            SUMMARY
          </div>
          <p className="rp-text">{resume.summary}</p>
        </div>
      )}

      {/* Skills — categorized */}
      {resume.skills?.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Zap size={14} />
            CORE COMPETENCIES
          </div>
          <div className="rp-skill-categories">
            {resume.skills.map((group, i) => (
              <div key={i} className="rp-skill-row">
                <span className="rp-skill-cat">{group.category}:</span>
                <span className="rp-skill-items">{group.items.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience + nested Projects */}
      {resume.experience?.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Briefcase size={14} />
            EXPERIENCE
          </div>
          {resume.experience.map((exp, i) => (
            <div key={i} className="rp-exp-block">
              <div className="rp-exp-meta">
                <span className="rp-exp-title">{exp.title}</span>
                <span className="rp-exp-dates">
                  {exp.startDate} – {exp.endDate}
                </span>
              </div>
              <div className="rp-exp-company">
                {exp.company}
                {exp.location ? `  ·  ${exp.location}` : ''}
              </div>
              {/* Role-level bullets — only shown when role has no projects */}
              {(!exp.projects || exp.projects.length === 0) && exp.bullets?.length > 0 && (
                <>
                  <ul className="rp-bullets">
                    {exp.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                  {/* Stack line for no-project roles */}
                  {exp.tech?.length > 0 && (
                    <p className="rp-proj-stack">Stack: {exp.tech.join(', ')}</p>
                  )}
                </>
              )}
              {/* Nested projects / work streams under this role */}
              {exp.projects?.length > 0 && (
                <div className="rp-nested-projects">
                  {exp.projects.map((proj, j) => (
                    <div key={j} className="rp-proj-nested">

                      {/* Project name — bold sub-header, no prefix */}
                      <div className="rp-proj-nested-name">{proj.name}</div>

                      {/* Project bullets — same visual as role bullets */}
                      {proj.bullets?.length > 0 && (
                        <ul className="rp-bullets">
                          {proj.bullets.map((b, k) => (
                            <li key={k}>{b}</li>
                          ))}
                        </ul>
                      )}

                      {/* Stack line at the bottom — italic, like reference */}
                      {proj.tech?.length > 0 && (
                        <p className="rp-proj-stack">
                          Stack: {proj.tech.join(', ')}
                          {proj.link && (
                            <>
                              {' · '}
                              <a
                                href={proj.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rp-proj-link"
                              >
                                {proj.link}
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {/* Education */}
      {resume.education?.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <GraduationCap size={14} />
            EDUCATION
          </div>
          {resume.education.map((edu, i) => (
            <div key={i} className="rp-edu-block">
              <span className="rp-edu-degree">{edu.degree}</span>
              <span className="rp-edu-inst">
                {edu.institution}
                {edu.year ? ` · ${edu.year}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {resume.certifications?.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Award size={14} />
            CERTIFICATIONS
          </div>
          <ul className="rp-bullets">
            {resume.certifications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Publications */}
      {resume.publications && resume.publications.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <FileText size={14} />
            PUBLICATIONS
          </div>
          <ul className="rp-bullets">
            {resume.publications.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Awards */}
      {resume.awards && resume.awards.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Award size={14} />
            AWARDS &amp; HONOURS
          </div>
          <ul className="rp-bullets">
            {resume.awards.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Languages */}
      {resume.languages && resume.languages.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Zap size={14} />
            LANGUAGES
          </div>
          <ul className="rp-bullets">
            {resume.languages.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
