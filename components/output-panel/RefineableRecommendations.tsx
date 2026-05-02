'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Lightbulb, Wand2 } from 'lucide-react';

interface RefineableRecommendationsProps {
  recommendations: string[];
  appliedRecs: string[];
  onRefine: (selected: string[]) => void;
  isRefining: boolean;
}

export function RefineableRecommendations({
  recommendations,
  appliedRecs,
  onRefine,
  isRefining,
}: RefineableRecommendationsProps) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [justApplied, setJustApplied] = useState(false);
  const prevIsRefining = useRef(false);

  const appliedSet = new Set(appliedRecs);
  const appliedCount = recommendations.filter((r) => appliedSet.has(r)).length;

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
        {appliedCount > 0 ? (
          <span className="rec-applied-count">{appliedCount}/{recommendations.length} applied</span>
        ) : (
          <span className="collapsible-count">{recommendations.length}</span>
        )}
        <span className="collapsible-chevron">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {open && (
        <div className="refine-body">
          {justApplied && (
            <div className="refine-applied-banner">
              ✅ Applied — resume updated. Select new items to refine again.
            </div>
          )}

          <label className="refine-select-all">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="refine-checkbox"
            />
            <span>{allChecked ? 'Deselect all' : 'Select all'}</span>
          </label>

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
