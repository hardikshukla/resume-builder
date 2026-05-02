'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { MissingKeyword } from '@/types';

interface MissingKeywordsPanelProps {
  missingKeywords: MissingKeyword[];
  onRefine: (recs: string[]) => void;
  isRefining: boolean;
}

export function MissingKeywordsPanel({
  missingKeywords,
  onRefine,
  isRefining,
}: MissingKeywordsPanelProps) {
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
