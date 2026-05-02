'use client';

interface ViewToggleProps {
  view: 'original' | 'updated';
  onChange: (v: 'original' | 'updated') => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
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
