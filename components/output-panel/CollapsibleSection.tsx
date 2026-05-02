'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
  className: string;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  icon,
  title,
  items,
  className,
  defaultOpen = false,
}: CollapsibleSectionProps) {
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
