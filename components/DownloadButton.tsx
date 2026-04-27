'use client';

import { ResumeBuilderOutput } from '@/types';
import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface DownloadButtonProps {
  type: 'resume' | 'coverLetter';
  data: ResumeBuilderOutput;
  companyName?: string;
}

export function DownloadButton({ type, data, companyName }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label =
    type === 'resume' ? 'Download Resume (.docx)' : 'Download Cover Letter (.docx)';

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, companyName }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Download failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] ?? `${type}.docx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="download-btn-wrap">
      <button
        id={`download-${type}-btn`}
        className="download-btn"
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? (
          <Loader2 size={16} className="spin" />
        ) : (
          <Download size={16} />
        )}
        {loading ? 'Generating…' : label}
      </button>
      {error && <p className="download-error">{error}</p>}
    </div>
  );
}
