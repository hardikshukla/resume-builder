'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface ResumeUploaderProps {
  onExtracted: (text: string, filename: string) => void;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'parsing'; filename: string }
  | { status: 'done'; filename: string; charCount: number }
  | { status: 'error'; message: string };

const ACCEPTED = ['.docx', '.txt'];

async function parseViaApi(file: File): Promise<{ text: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/parse-resume', {
    method: 'POST',
    body: formData,
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Server error ${res.status}`);
  }

  return { text: json.text as string, filename: json.filename as string };
}

export function ResumeUploader({ onExtracted }: ResumeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  async function processFile(file: File) {
    setState({ status: 'parsing', filename: file.name });
    try {
      const { text, filename } = await parseViaApi(file);
      setState({ status: 'done', filename, charCount: text.length });
      onExtracted(text, filename);
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse file.',
      });
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ''; // allow re-uploading same file
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setState({ status: 'idle' });
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (state.status !== 'dragging') setState({ status: 'dragging' });
  }

  function handleDragLeave() {
    if (state.status === 'dragging') setState({ status: 'idle' });
  }

  function reset() {
    setState({ status: 'idle' });
  }

  const isDragging = state.status === 'dragging';
  const isParsing  = state.status === 'parsing';

  return (
    <div className="uploader-wrap">
      {/* Drop zone */}
      <div
        className={`drop-zone${isDragging ? ' dragging' : ''}${isParsing ? ' parsing' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isParsing && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload resume file"
        onKeyDown={(e) => e.key === 'Enter' && !isParsing && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          onChange={handleFileChange}
          id="resume-file-input"
        />

        <div className="drop-zone-content">
          {isParsing ? (
            <>
              <div className="upload-spinner" />
              <span className="upload-label">
                Extracting text from {(state as { filename: string }).filename}…
              </span>
            </>
          ) : (
            <>
              <div className="upload-icon-wrap">
                <Upload size={18} />
              </div>
              <div className="upload-text-group">
                <span className="upload-label">
                  {isDragging ? 'Drop to upload' : 'Upload resume file'}
                </span>
                <span className="upload-hint">
                  .docx or .txt · drag &amp; drop or click to browse
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Success */}
      {state.status === 'done' && (
        <div className="upload-success">
          <FileText size={14} />
          <span className="upload-success-name">{state.filename}</span>
          <span className="upload-success-count">
            {state.charCount.toLocaleString()} chars extracted
          </span>
          <button
            className="upload-clear-btn"
            onClick={reset}
            aria-label="Clear upload status"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="upload-error">
          <AlertCircle size={14} />
          <span className="upload-error-msg">{state.message}</span>
          <button
            className="upload-clear-btn"
            onClick={reset}
            aria-label="Dismiss error"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
