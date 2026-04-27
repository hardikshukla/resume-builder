'use client';

import { ResumeBuilderOutput } from '@/types';
import { DownloadButton } from './DownloadButton';
import { useState } from 'react';
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

function RefineableRecommendations({
  recommendations,
  onRefine,
  isRefining,
}: {
  recommendations: string[];
  onRefine: (selected: string[]) => void;
  isRefining: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  if (recommendations.length === 0) return null;

  const allChecked = selected.size === recommendations.length;

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
        <span className="collapsible-count">{recommendations.length}</span>
        <span className="collapsible-chevron">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {open && (
        <div className="refine-body">
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

          {/* Individual recommendations */}
          <ul className="collapsible-body refine-list">
            {recommendations.map((rec, i) => (
              <li key={i} className={`collapsible-item refine-item ${selected.has(i) ? 'refine-checked' : ''}`}>
                <label className="refine-label">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="refine-checkbox"
                  />
                  <span>{rec}</span>
                </label>
              </li>
            ))}
          </ul>

          {/* Apply & Refine button — only shown when ≥1 selected */}
          {selected.size > 0 && (
            <div className="refine-action-row">
              <button
                className="refine-btn"
                onClick={handleRefine}
                disabled={isRefining}
              >
                {isRefining ? (
                  <>
                    <span className="refine-spinner" />
                    Refining…
                  </>
                ) : (
                  <>
                    <Wand2 size={15} />
                    Apply &amp; Refine ({selected.size} selected)
                  </>
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
    </div>
  );
}

export function OutputPanel({ data, companyName, onRefine, isRefining }: OutputPanelProps) {
  const { result, providerUsed, fallbackOccurred, fallbackReason } = data;
  const { gapAnalysis, resume, coverLetter } = result;

  return (
    <div className="output-panel">
      {/* Fallback notice */}
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

      {/* Match Score */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon">🎯</div>
          <h2 className="card-title">Match Analysis</h2>
          <span className="provider-tag">via {providerUsed}</span>
        </div>
        <ScoreBadge score={gapAnalysis.matchScore} />

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
            onRefine={onRefine}
            isRefining={isRefining}
          />
        </div>
      </div>

      {/* Resume Preview */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon">📄</div>
          <h2 className="card-title">Tailored Resume Preview</h2>
        </div>
        <ResumePreview resume={resume} />
        <div className="download-row">
          <DownloadButton type="resume" data={result} companyName={companyName} />
        </div>
      </div>

      {/* Cover Letter Preview */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon">✉️</div>
          <h2 className="card-title">Cover Letter</h2>
        </div>
        <div className="cover-preview">
          <div className="cover-subject">Re: {coverLetter.subject}</div>
          <div className="cover-body">
            {coverLetter.body.split('\n').filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
        <div className="download-row">
          <DownloadButton
            type="coverLetter"
            data={result}
            companyName={companyName}
          />
        </div>
      </div>
    </div>
  );
}
