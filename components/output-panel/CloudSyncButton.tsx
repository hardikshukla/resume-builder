'use client';

import { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, Loader2 } from 'lucide-react';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { toCamelCase, toPascalCase, sanitizeFilename, getTimestampStr } from '@/lib/utils/string';
import { ResumeBuilderOutput } from '@/types';

interface CloudSyncButtonProps {
  data: ResumeBuilderOutput;
  companyName?: string;
  dropboxToken: string;
  skipDropboxPrompt: boolean;
  setSkipDropboxPrompt: (v: boolean) => void;
  onLocalDownload: () => void;
}

export function CloudSyncButton({
  data,
  companyName,
  dropboxToken,
  skipDropboxPrompt,
  setSkipDropboxPrompt,
  onLocalDownload,
}: CloudSyncButtonProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSkip, setPendingSkip] = useState(skipDropboxPrompt);

  useEffect(() => {
    if (showPrompt) setPendingSkip(skipDropboxPrompt);
  }, [showPrompt, skipDropboxPrompt]);

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

      const resumeBlob = await generateResumeDOCX(resume);

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
