import { useState } from 'react';
import { ChevronDown, ChevronUp, FileSearch, FileText, Tag } from 'lucide-react';
import { GapAnalysis } from '@/types';

export function ATSOptimizationSummary({ gapAnalysis }: { gapAnalysis: GapAnalysis }) {
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
