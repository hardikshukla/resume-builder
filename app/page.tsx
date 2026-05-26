'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GitHubIcon from '@mui/icons-material/GitHub';
import LockIcon from '@mui/icons-material/Lock';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useApiKey } from '@/hooks/useApiKey';
import { useGenerate } from '@/hooks/useGenerate';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { buildDownloadFilename } from '@/lib/utils/string';
import { MAX_RESUME_CHARS, MAX_JD_CHARS, RESUME_WARN_CHARS, JD_WARN_CHARS } from '@/lib/constants';

// ── Simple word-level diff for highlights ────────────────────────────────────
function diffWords(original: string, current: string): React.ReactNode[] {
  if (original === current) return [current];
  const oWords = original.split(/(\s+)/);
  const cWords = current.split(/(\s+)/);
  const dp: number[][] = Array(oWords.length + 1)
    .fill(0)
    .map(() => Array(cWords.length + 1).fill(0));
  for (let i = 1; i <= oWords.length; i++)
    for (let j = 1; j <= cWords.length; j++)
      dp[i][j] = oWords[i - 1] === cWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const result: React.ReactNode[] = [];
  let i = oWords.length, j = cWords.length, k = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oWords[i - 1] === cWords[j - 1]) {
      result.unshift(<span key={k++}>{oWords[i - 1]}</span>);
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift(<ins key={k++} style={{ textDecoration: 'none', background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>{cWords[j - 1]}</ins>);
      j--;
    } else {
      result.unshift(<del key={k++} style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', textDecoration: 'line-through' }}>{oWords[i - 1]}</del>);
      i--;
    }
  }
  return result;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const A4_STYLES = {
  backgroundColor: '#ffffff',
  color: '#000000',
  p: 6,
  fontFamily: '"Times New Roman", Times, serif',
  fontSize: '11pt',
  lineHeight: 1.5,
  boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
  border: '1px solid #d3d3d3',
  minHeight: '11in',
  width: '100%',
  maxWidth: '8.5in',
  mx: 'auto',
} as const;

const SECTION_HEADER_SX = {
  fontFamily: '"Times New Roman"',
  fontSize: '11pt',
  borderBottom: '1px solid #000',
  pb: 0.2,
  mb: 0.8,
  textTransform: 'uppercase' as const,
  fontWeight: 700,
};

const BODY_TEXT_SX = {
  fontFamily: '"Times New Roman"',
  fontSize: '11pt',
};

const DEFAULT_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommended)' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Advanced)' },
];

export default function Home() {
  const { anthropicKey, dropboxToken, setAnthropicKey, setDropboxToken } = useApiKey();
  const {
    resume,
    jobDescription,
    companyName,
    selectedModel,
    setSelectedModel,
    setJD,
    setCompany,
    handleResumeChange,
    output,
    originalOutput,
    isLoading,
    error,
    handleGenerate,
    handleRefine,
    handleRevert,
  } = useGenerate();

  const [activeTab, setActiveTab] = useState(0);
  const [showHighlights, setShowHighlights] = useState(true);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [appliedRecs, setAppliedRecs] = useState<Set<string>>(new Set());
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showDropboxToken, setShowDropboxToken] = useState(false);
  const [dropboxStatus, setDropboxStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [isVerifyingDropbox, setIsVerifyingDropbox] = useState(false);
  const [dropboxVerifyStatus, setDropboxVerifyStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.hasServerKey) {
          setHasServerKey(true);
        }
      })
      .catch((err) => console.error('Failed to load server config:', err));
  }, []);

  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>(DEFAULT_MODELS);

  useEffect(() => {
    const key = anthropicKey || (hasServerKey ? 'server' : '');
    if (!key) {
      setAvailableModels(DEFAULT_MODELS);
      return;
    }

    const timer = setTimeout(() => {
      fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey: anthropicKey || undefined }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.models && data.models.length > 0) {
            setAvailableModels(data.models);
          }
        })
        .catch((err) => console.error('Failed to fetch models:', err));
    }, 500);

    return () => clearTimeout(timer);
  }, [anthropicKey, hasServerKey]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setParseError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse resume file.');
      }

      handleResumeChange(data.text);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse resume.');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleVerifyDropboxToken = async () => {
    if (!dropboxToken) return;
    setIsVerifyingDropbox(true);
    setDropboxVerifyStatus(null);
    try {
      const res = await fetch('/api/dropbox/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: dropboxToken }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setDropboxVerifyStatus({ success: true, message: `Connected: ${data.account}` });
      } else {
        setDropboxVerifyStatus({ success: false, message: data.error || 'Verification failed.' });
      }
    } catch (err) {
      console.error('Dropbox token verification error:', err);
      setDropboxVerifyStatus({ success: false, message: 'Server verification failed.' });
    } finally {
      setIsVerifyingDropbox(false);
    }
  };


  // Inactivity session lock (20 min)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.clear();
        setIsSessionExpired(true);
      }, 40 * 60 * 1000);
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, []);

  useEffect(() => {
    const clearOnUnload = () => sessionStorage.clear();
    window.addEventListener('beforeunload', clearOnUnload);
    return () => window.removeEventListener('beforeunload', clearOnUnload);
  }, []);

  const handleRecToggle = (recId: string) => {
    setSelectedRecs((prev) =>
      prev.includes(recId) ? prev.filter((id) => id !== recId) : [...prev, recId]
    );
  };

  const isDealbreakerResolved = (dbId: string) =>
    selectedRecs.some((recId) => {
      const rec = output?.gapAnalysis.recommendations.find((r) => r.id === recId);
      return rec?.resolvesDealbreakers.includes(dbId);
    });

  // Deduplication
  const uniqueStrongMatches = output ? Array.from(new Set(output.gapAnalysis.strongMatches)) : [];
  const uniqueKeywordsAdded = output ? Array.from(new Set(output.gapAnalysis.keywordsAdded)) : [];
  const uniqueDealbreakers = output
    ? Array.from(new Map(output.gapAnalysis.dealbreakers.map((db) => [db.text, db])).values())
    : [];
  const uniqueRecommendations = output
    ? Array.from(new Map(output.gapAnalysis.recommendations.map((r) => [r.text, r])).values())
    : [];

  const getCompanyStr = () =>
    (companyName || output?.gapAnalysis.extractedCompanyName || '').trim();

  const getFilename = (type: 'resume' | 'coverLetter') =>
    buildDownloadFilename(
      output?.resume.name ?? '',
      getCompanyStr(),
      type
    );

  const handleDownload = async (type: 'resume' | 'coverLetter') => {
    if (!output) return;
    try {
      let blob: Blob;
      const filename = getFilename(type);
      if (type === 'resume') {
        blob = await generateResumeDOCX(output.resume);
      } else {
        if (!output.coverLetter) throw new Error('No cover letter available');
        blob = await generateCoverLetterDOCX(output.coverLetter, output.resume, getCompanyStr());
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err}`);
    }
  };

  const handleSaveToDropbox = async (type: 'resume' | 'coverLetter') => {
    if (!output || !dropboxToken) return;
    setDropboxStatus(null);
    try {
      const co = getCompanyStr();
      const filename = getFilename(type);
      let blob: Blob;
      if (type === 'resume') {
        blob = await generateResumeDOCX(output.resume);
      } else {
        if (!output.coverLetter) throw new Error('No cover letter available');
        blob = await generateCoverLetterDOCX(output.coverLetter, output.resume, co);
      }
      const folderName = (co || 'Tailored').replace(/[^a-z0-9]/gi, '_');
      const path = `/Resume Builder/${folderName}/${filename}`;
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dropboxToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: true, mute: false }),
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      });
      if (!res.ok) throw new Error(await res.text() || 'Upload failed');
      setDropboxStatus({ type: 'success', message: `Saved to Dropbox: ${path}` });
    } catch (err) {
      setDropboxStatus({ type: 'error', message: err instanceof Error ? err.message : 'Dropbox failed.' });
    }
  };

  const getCharColor = (count: number, limit: number, warn: number) => {
    if (count > limit) return 'error.main';
    if (count > warn) return 'warning.main';
    return 'text.secondary';
  };

  const renderDiff = (original: string | undefined, current: string) => {
    if (showHighlights && original && current !== original) return <>{diffWords(original, current)}</>;
    return current;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0f1117' }}>

      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', py: 2, px: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, background: 'linear-gradient(135deg, #6c63ff, #a855f7)', borderRadius: 2, display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 0 20px rgba(108,99,255,0.35)' }}>
            <AutoAwesomeIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, background: 'linear-gradient(90deg, #e8eaf0, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Resume Builder
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              AI-powered · ATS-optimized · Tailored to every JD
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip label="v3.0" size="small" variant="outlined" sx={{ borderColor: 'divider', color: 'text.secondary' }} />
          <IconButton href="https://github.com/hardikshukla/resume-builder" target="_blank" rel="noopener noreferrer" sx={{ color: 'text.secondary' }}>
            <GitHubIcon />
          </IconButton>
        </Box>
      </Box>

      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 4 }}>
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Left Panel (Inputs) ────────────────────────────────── */}
          <Box sx={{ flex: '0 0 auto', width: { xs: '100%', lg: '350px' } }}>
            <Box sx={{ position: { lg: 'sticky' }, top: 80, maxHeight: { lg: 'calc(100vh - 120px)' }, overflowY: 'auto' }}>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Tailoring Parameters
                </Typography>

                {/* Resume */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Candidate Resume
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      startIcon={isParsingFile ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                      disabled={isParsingFile}
                      sx={{ py: 0.5 }}
                    >
                      {isParsingFile ? 'Parsing...' : 'Upload DOCX/TXT'}
                      <input
                        type="file"
                        hidden
                        accept=".docx,.txt"
                        onChange={handleFileUpload}
                      />
                    </Button>
                  </Box>
                  <TextField multiline rows={8} fullWidth value={resume}
                    onChange={(e) => handleResumeChange(e.target.value)}
                    placeholder="Paste your current resume or upload above..." variant="outlined"
                    sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }} />
                  {parseError && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                      ⚠️ {parseError}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, color: getCharColor(resume.length, MAX_RESUME_CHARS, RESUME_WARN_CHARS) }}>
                    {resume.length.toLocaleString()} / {MAX_RESUME_CHARS.toLocaleString()} chars
                  </Typography>
                </Box>

                {/* Job Description */}
                <Box>
                  <TextField label="Job Description" multiline rows={8} fullWidth value={jobDescription}
                    onChange={(e) => setJD(e.target.value)}
                    placeholder="Paste the target Job Description..." variant="outlined"
                    sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }} />
                  <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, color: getCharColor(jobDescription.length, MAX_JD_CHARS, JD_WARN_CHARS) }}>
                    {jobDescription.length.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()} chars
                  </Typography>
                </Box>

                {/* Company Name */}
                <TextField label="Company Name (Optional)" fullWidth value={companyName}
                  onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Google"
                  sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }} />

                {/* Anthropic Key */}
                <TextField 
                  label={hasServerKey ? "Anthropic API Key (Configured on Server)" : "Anthropic API Key (Mandatory)"}
                  type={showAnthropicKey ? 'text' : 'password'} fullWidth
                  value={hasServerKey ? '' : anthropicKey} 
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder={hasServerKey ? "Configured on server via environment variable." : "Enter your Anthropic API Key..."}
                  disabled={hasServerKey}
                  error={!hasServerKey && !anthropicKey}
                  helperText={!hasServerKey && !anthropicKey ? "Anthropic API Key is required to run LLM operations." : ""}
                  sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }}
                  slotProps={{ input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowAnthropicKey(!showAnthropicKey)} edge="end" disabled={hasServerKey}>
                          {showAnthropicKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}}
                />

                {/* Claude Model Selection */}
                <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }}>
                  <InputLabel id="model-select-label">Claude Model</InputLabel>
                  <Select
                    labelId="model-select-label"
                    value={selectedModel}
                    label="Claude Model"
                    onChange={(e) => setSelectedModel(e.target.value as string)}
                  >
                    {availableModels.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.name}
                      </MenuItem>
                    ))}
                    {!availableModels.some((m) => m.id === selectedModel) && (
                      <MenuItem value={selectedModel}>
                        {selectedModel}
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>

                {/* Dropbox Token */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField label="Dropbox API Token (Optional)"
                    type={showDropboxToken ? 'text' : 'password'} fullWidth
                    value={dropboxToken} onChange={(e) => setDropboxToken(e.target.value)}
                    placeholder="Enter Dropbox OAuth token..."
                    sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }}
                    slotProps={{ input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowDropboxToken(!showDropboxToken)} edge="end">
                            {showDropboxToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}}
                  />
                  {dropboxToken && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleVerifyDropboxToken}
                        disabled={isVerifyingDropbox}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        {isVerifyingDropbox ? <CircularProgress size={16} /> : 'Verify Token'}
                      </Button>
                      {dropboxVerifyStatus && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: dropboxVerifyStatus.success ? 'success.main' : 'error.main',
                            fontWeight: 600,
                          }}
                        >
                          {dropboxVerifyStatus.success ? '✓ ' : '✗ '}{dropboxVerifyStatus.message}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Generate Button */}
                <Button variant="contained" size="large" fullWidth
                  onClick={() => handleGenerate(anthropicKey)}
                  disabled={isLoading || resume.length === 0 || jobDescription.length === 0 || resume.length > MAX_RESUME_CHARS || jobDescription.length > MAX_JD_CHARS || (!hasServerKey && !anthropicKey)}
                  sx={{ background: 'linear-gradient(135deg, #6c63ff, #a855f7)', boxShadow: '0 4px 20px rgba(108,99,255,0.4)', py: 1.5, '&:hover': { background: 'linear-gradient(135deg, #5b54e5, #9546e5)' } }}>
                  {isLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '✨ Generate Tailored Resume'}
                </Button>

                <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  API keys stored in session only · Never logged server-side
                </Typography>
              </Paper>
            </Box>
          </Box>

          {/* ── Right Panel (Output) ───────────────────────────────── */}
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>

            {/* Loading */}
            {isLoading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 3 }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #6c63ff, #a855f7)', animation: 'pulse 1.5s ease-in-out infinite', boxShadow: '0 0 40px rgba(108,99,255,0.4)' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Optimizing your profile…</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Analyzing JD · Weaving evidence-backed keywords · Writing cover letter
                </Typography>
              </Box>
            )}

            {/* Error */}
            {error && !isLoading && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* Empty state */}
            {!isLoading && !output && !error && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 500, border: '1px dashed', borderColor: 'divider', borderRadius: 3, p: 6, textAlign: 'center', gap: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Your Tailored Profile Appears Here</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 480 }}>
                  Paste your resume and a job description, then click Generate.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {['🎯 Keyword Coverage', '📊 Gap Analysis', '📄 ATS-Ready Resume', '✉️ Cover Letter', '📥 DOCX Export'].map((item) => (
                    <Chip key={item} label={item} variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Output */}
            {output && !isLoading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                {/* Refined banner */}
                {originalOutput && output !== originalOutput && (
                  <Paper elevation={0} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(108,99,255,0.08)', border: '1px solid', borderColor: 'primary.main', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      💡 Refined · Score: {originalOutput.gapAnalysis.matchScore}% → {output.gapAnalysis.matchScore}%
                    </Typography>
                    <Button size="small" variant="outlined" onClick={handleRevert}>Revert to Original</Button>
                  </Paper>
                )}

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab label="Gap Analysis" id="tab-gap" aria-controls="tabpanel-gap" />
                    <Tab label="Tailored Resume" id="tab-resume" aria-controls="tabpanel-resume" />
                    <Tab label="Cover Letter" id="tab-cover" aria-controls="tabpanel-cover" />
                  </Tabs>
                </Box>

                {/* ── Tab 0: Gap Analysis ─────────────────────────── */}
                {activeTab === 0 && (
                  <Box id="tabpanel-gap" role="tabpanel" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>

                      {/* Match Score */}
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>ATS Keyword Match Score</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <LinearProgress variant="determinate" value={output.gapAnalysis.matchScore}
                          sx={{ flexGrow: 1, height: 10, borderRadius: 5 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', minWidth: 50 }}>
                          {output.gapAnalysis.matchScore}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
                        Placement-weighted coverage (Summary &amp; Skills score higher). Deducts 5 pts per unresolved dealbreaker. Capped at 95.
                      </Typography>

                      {/* Strong Matches */}
                      <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon color="success" fontSize="small" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              ✅ Strong Matches ({uniqueStrongMatches.length})
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {uniqueStrongMatches.map((kw) => (
                              <Chip key={kw} label={kw} color="success" variant="outlined" size="small" />
                            ))}
                          </Box>
                        </AccordionDetails>
                      </Accordion>

                      {/* Keywords Added by Claude */}
                      <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AutoAwesomeIcon color="primary" fontSize="small" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              💡 Keywords Added by Claude ({uniqueKeywordsAdded.length})
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {uniqueKeywordsAdded.map((kw) => (
                              <Chip key={kw} label={kw} color="primary" variant="outlined" size="small" />
                            ))}
                          </Box>
                        </AccordionDetails>
                      </Accordion>

                      {/* Dealbreakers */}
                      <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ErrorIcon color="error" fontSize="small" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              ❌ Dealbreakers / Missing ({uniqueDealbreakers.length})
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {uniqueDealbreakers.map((db) => {
                              const resolved = isDealbreakerResolved(db.id);
                              return (
                                <FormControlLabel key={db.id}
                                  control={<Checkbox checked={resolved} disabled color="error" />}
                                  label={
                                    <Typography variant="body2" sx={{
                                      textDecoration: resolved ? 'line-through' : 'none',
                                      color: resolved ? 'text.secondary' : 'error.main',
                                      opacity: resolved ? 0.6 : 1,
                                      fontWeight: resolved ? 400 : 600,
                                    }}>
                                      {db.text}{resolved && ' (Covered by recommendation)'}
                                    </Typography>
                                  }
                                />
                              );
                            })}
                            {uniqueDealbreakers.length === 0 && (
                              <Typography variant="body2" sx={{ color: 'success.main' }}>No dealbreakers — excellent match!</Typography>
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>

                      {/* Recommendations */}
                      <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 2 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <WarningIcon color="warning" fontSize="small" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              📋 Actionable Recommendations ({uniqueRecommendations.length})
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {uniqueRecommendations.map((rec) => {
                              const applied = appliedRecs.has(rec.id);
                              const checked = selectedRecs.includes(rec.id);
                              return (
                                <FormControlLabel key={rec.id}
                                  control={
                                    <Checkbox
                                      checked={checked}
                                      onChange={() => !applied && handleRecToggle(rec.id)}
                                      color="warning"
                                      disabled={applied}
                                    />
                                  }
                                  label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="body2" sx={{
                                        textDecoration: applied || checked ? 'line-through' : 'none',
                                        color: applied ? 'success.main' : checked ? 'text.secondary' : 'warning.main',
                                        fontWeight: applied ? 400 : checked ? 400 : 500,
                                        opacity: applied ? 0.7 : 1,
                                      }}>
                                        {rec.text}
                                      </Typography>
                                      {applied && (
                                        <Typography variant="caption" sx={{
                                          color: 'success.main',
                                          fontWeight: 700,
                                          fontSize: '0.65rem',
                                          backgroundColor: 'rgba(46,160,67,0.12)',
                                          px: 0.8,
                                          py: 0.2,
                                          borderRadius: 1,
                                          whiteSpace: 'nowrap',
                                        }}>
                                          ✓ Applied
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                />
                              );
                            })}
                          </Box>
                        </AccordionDetails>
                      </Accordion>

                      <Button variant="contained" color="warning" fullWidth
                        onClick={async () => {
                          const recTexts = selectedRecs.map(id => {
                            const rec = uniqueRecommendations.find(r => r.id === id);
                            return rec?.text ?? id;
                          });
                          const success = await handleRefine(recTexts, anthropicKey);
                          if (success) {
                            setAppliedRecs(prev => {
                              const next = new Set<string>();
                              prev.forEach(id => next.add(id));
                              selectedRecs.forEach(id => next.add(id));
                              return next;
                            });
                            setSelectedRecs([]);
                          }
                        }}
                        disabled={selectedRecs.length === 0 || isLoading || (!hasServerKey && !anthropicKey)}
                        sx={{ py: 1.2, fontWeight: 700 }}>
                        {isLoading ? <CircularProgress size={20} /> : `Apply Selected Suggestions (${selectedRecs.length})`}
                      </Button>

                      {output.gapAnalysis.summaryChanges && (
                        <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(108,99,255,0.06)', border: '1px solid', borderColor: 'rgba(108,99,255,0.2)', borderRadius: 2 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            📝 Summary changes: {output.gapAnalysis.summaryChanges}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                )}

                {/* ── Tab 1: Tailored Resume ──────────────────────── */}
                {activeTab === 1 && (
                  <Box id="tabpanel-resume" role="tabpanel" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <FormControlLabel
                        control={<Switch checked={showHighlights} onChange={(e) => setShowHighlights(e.target.checked)} color="success" />}
                        label="Show Highlights"
                      />
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button startIcon={<DownloadIcon />} variant="outlined" size="small" onClick={() => handleDownload('resume')}>Download DOCX</Button>
                        {dropboxToken && (
                          <Button startIcon={<CloudUploadIcon />} variant="outlined" color="primary" size="small" onClick={() => handleSaveToDropbox('resume')}>Save to Dropbox</Button>
                        )}
                        <Button startIcon={<PrintIcon />} variant="contained" color="secondary" size="small" onClick={() => window.print()}>Print / PDF</Button>
                      </Box>
                    </Box>

                    {dropboxStatus && (
                      <Alert severity={dropboxStatus.type} onClose={() => setDropboxStatus(null)}>{dropboxStatus.message}</Alert>
                    )}

                    {/* A4 Preview */}
                    <Box id="resume-print-area" sx={A4_STYLES}>
                      {/* Header */}
                      <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, fontSize: '14pt', textTransform: 'uppercase' }}>
                          {output.resume.name || 'Candidate Name'}
                        </Typography>
                        <Typography sx={{ ...BODY_TEXT_SX, mt: 0.5 }}>
                          {[output.resume.contact?.email, output.resume.contact?.phone, output.resume.contact?.linkedin, output.resume.contact?.github, output.resume.contact?.location].filter(Boolean).join('  |  ')}
                        </Typography>
                        <Divider sx={{ mt: 1, borderColor: '#000', borderBottomWidth: 1.5 }} />
                      </Box>

                      {/* Summary */}
                      {output.resume.summary && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Summary</Typography>
                          <Typography sx={{ ...BODY_TEXT_SX, textAlign: 'justify' }}>
                            {renderDiff(originalOutput?.resume.summary, output.resume.summary)}
                          </Typography>
                        </Box>
                      )}

                      {/* Skills */}
                      {output.resume.skills && output.resume.skills.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Core Competencies</Typography>
                          {output.resume.skills.map((sg, idx) => (
                            <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.4 }}>
                              <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, minWidth: 160, flexShrink: 0 }}>
                                {sg.category}:
                              </Typography>
                              <Typography sx={BODY_TEXT_SX}>
                                {renderDiff(originalOutput?.resume.skills?.[idx]?.items.join(', '), sg.items.join(', '))}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Experience */}
                      {output.resume.experience && output.resume.experience.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Experience</Typography>
                          {output.resume.experience.map((exp, expIdx) => {
                            const origExp = originalOutput?.resume.experience?.[expIdx];
                            return (
                              <Box key={expIdx} sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>
                                    {exp.title} | {exp.company}
                                  </Typography>
                                  <Typography sx={BODY_TEXT_SX}>
                                    {exp.startDate} – {exp.endDate}
                                  </Typography>
                                </Box>
                                {exp.location && (
                                  <Typography sx={{ ...BODY_TEXT_SX, fontStyle: 'italic', mb: 0.5 }}>{exp.location}</Typography>
                                )}
                                {(!exp.projects || exp.projects.length === 0) && (
                                  <>
                                    <Box component="ul" sx={{ m: 0, pl: 3 }}>
                                      {exp.bullets.map((b, bi) => (
                                        <Box component="li" key={bi} sx={{ mb: 0.3 }}>
                                          <Typography sx={BODY_TEXT_SX}>
                                            {renderDiff(origExp?.bullets?.[bi], b)}
                                          </Typography>
                                        </Box>
                                      ))}
                                    </Box>
                                    {exp.tech && exp.tech.length > 0 && (
                                      <Typography sx={{ ...BODY_TEXT_SX, fontSize: '10pt', fontStyle: 'italic', mt: 0.4 }}>
                                        Stack: {exp.tech.join(', ')}
                                      </Typography>
                                    )}
                                  </>
                                )}
                                {exp.projects && exp.projects.length > 0 && (
                                  <Box sx={{ mt: 0.5 }}>
                                    {exp.projects.map((proj, pi) => {
                                      const origProj = origExp?.projects?.[pi];
                                      return (
                                        <Box key={pi} sx={{ pl: 2, mb: 1 }}>
                                          <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>{proj.name}</Typography>
                                          {proj.description && (
                                            <Typography sx={{ ...BODY_TEXT_SX, fontStyle: 'italic' }}>{proj.description}</Typography>
                                          )}
                                          <Box component="ul" sx={{ m: 0, pl: 2, mt: 0.3 }}>
                                            {proj.bullets.map((b, bi) => (
                                              <Box component="li" key={bi} sx={{ mb: 0.2 }}>
                                                <Typography sx={BODY_TEXT_SX}>
                                                  {renderDiff(origProj?.bullets?.[bi], b)}
                                                </Typography>
                                              </Box>
                                            ))}
                                          </Box>
                                          {proj.tech && proj.tech.length > 0 && (
                                            <Typography sx={{ ...BODY_TEXT_SX, fontSize: '10pt', fontStyle: 'italic', mt: 0.3 }}>
                                              Stack: {proj.tech.join(', ')}{proj.link ? ` | ${proj.link}` : ''}
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      )}

                      {/* Standalone Projects */}
                      {output.resume.projects && output.resume.projects.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Projects</Typography>
                          {output.resume.projects.map((proj, pi) => {
                            const origProj = originalOutput?.resume.projects?.[pi];
                            return (
                              <Box key={pi} sx={{ mb: 1.5 }}>
                                <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>{proj.name}</Typography>
                                {proj.description && (
                                  <Typography sx={{ ...BODY_TEXT_SX, fontStyle: 'italic', mb: 0.3 }}>{proj.description}</Typography>
                                )}
                                <Box component="ul" sx={{ m: 0, pl: 3 }}>
                                  {proj.bullets.map((b, bi) => (
                                    <Box component="li" key={bi} sx={{ mb: 0.3 }}>
                                      <Typography sx={BODY_TEXT_SX}>
                                        {renderDiff(origProj?.bullets?.[bi], b)}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                                {proj.tech && proj.tech.length > 0 && (
                                  <Typography sx={{ ...BODY_TEXT_SX, fontSize: '10pt', fontStyle: 'italic', mt: 0.3 }}>
                                    Stack: {proj.tech.join(', ')}{proj.link ? ` | ${proj.link}` : ''}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      )}

                      {/* Education */}
                      {output.resume.education && output.resume.education.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Education</Typography>
                          {output.resume.education.map((edu, i) => (
                            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                              <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>
                                {edu.degree} — {edu.institution}
                              </Typography>
                              <Typography sx={BODY_TEXT_SX}>{edu.year}</Typography>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Certifications */}
                      {output.resume.certifications && output.resume.certifications.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Certifications</Typography>
                          <Box component="ul" sx={{ m: 0, pl: 3 }}>
                            {output.resume.certifications.map((c, i) => (
                              <Box component="li" key={i} sx={{ mb: 0.3 }}><Typography sx={BODY_TEXT_SX}>{c}</Typography></Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Publications */}
                      {output.resume.publications && output.resume.publications.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Publications</Typography>
                          <Box component="ul" sx={{ m: 0, pl: 3 }}>
                            {output.resume.publications.map((p, i) => (
                              <Box component="li" key={i} sx={{ mb: 0.3 }}><Typography sx={BODY_TEXT_SX}>{p}</Typography></Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Awards */}
                      {output.resume.awards && output.resume.awards.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Awards &amp; Honours</Typography>
                          <Box component="ul" sx={{ m: 0, pl: 3 }}>
                            {output.resume.awards.map((a, i) => (
                              <Box component="li" key={i} sx={{ mb: 0.3 }}><Typography sx={BODY_TEXT_SX}>{a}</Typography></Box>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Languages */}
                      {output.resume.languages && output.resume.languages.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={SECTION_HEADER_SX}>Languages</Typography>
                          <Box component="ul" sx={{ m: 0, pl: 3 }}>
                            {output.resume.languages.map((l, i) => (
                              <Box component="li" key={i} sx={{ mb: 0.3 }}><Typography sx={BODY_TEXT_SX}>{l}</Typography></Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {/* ── Tab 2: Cover Letter ─────────────────────────── */}
                {activeTab === 2 && (
                  <Box id="tabpanel-cover" role="tabpanel" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <FormControlLabel
                        control={<Switch checked={showHighlights} onChange={(e) => setShowHighlights(e.target.checked)} color="success" />}
                        label="Show Highlights"
                      />
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button startIcon={<ContentCopyIcon />} variant="outlined" size="small"
                          onClick={() => { if (output.coverLetter) { navigator.clipboard.writeText(output.coverLetter.body); } }}>
                          Copy Body
                        </Button>
                        <Button startIcon={<DownloadIcon />} variant="outlined" size="small" onClick={() => handleDownload('coverLetter')}>Download DOCX</Button>
                        {dropboxToken && (
                          <Button startIcon={<CloudUploadIcon />} variant="outlined" color="primary" size="small" onClick={() => handleSaveToDropbox('coverLetter')}>Save to Dropbox</Button>
                        )}
                      </Box>
                    </Box>

                    {dropboxStatus && (
                      <Alert severity={dropboxStatus.type} onClose={() => setDropboxStatus(null)}>{dropboxStatus.message}</Alert>
                    )}

                    {output.coverLetter ? (
                      <Box sx={A4_STYLES}>
                        {/* Header */}
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                          <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, fontSize: '14pt' }}>
                            {output.resume.name || 'Candidate Name'}
                          </Typography>
                          <Typography sx={{ ...BODY_TEXT_SX, mt: 0.5 }}>
                            {[output.resume.contact?.email, output.resume.contact?.phone, output.resume.contact?.linkedin, output.resume.contact?.github, output.resume.contact?.location].filter(Boolean).join('  |  ')}
                          </Typography>
                          <Divider sx={{ mt: 1, borderColor: '#000', borderBottomWidth: 1.5 }} />
                        </Box>
                        <Typography sx={{ ...BODY_TEXT_SX, mt: 3, mb: 2 }}>
                          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </Typography>
                        <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, mb: 2 }}>
                          Subject: {output.coverLetter.subject}
                        </Typography>
                        <Typography sx={{ ...BODY_TEXT_SX, mb: 2 }}>Dear Hiring Manager,</Typography>
                        {output.coverLetter.body.split(/\n+/).filter(Boolean).map((para, i) => (
                          <Typography key={i} sx={{ ...BODY_TEXT_SX, textAlign: 'justify', mb: 1.5 }}>
                            {renderDiff(originalOutput?.coverLetter?.body.split(/\n+/).filter(Boolean)[i], para)}
                          </Typography>
                        ))}
                        <Typography sx={{ ...BODY_TEXT_SX, mt: 3 }}>Sincerely,</Typography>
                        <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, mt: 3 }}>
                          {output.resume.name || 'Candidate Name'}
                        </Typography>
                      </Box>
                    ) : (
                      <Alert severity="warning">
                        Cover letter was not generated this round. Use Apply &amp; Refine to trigger it.
                      </Alert>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Container>

      {/* Footer */}
      <Box sx={{ borderTop: 1, borderColor: 'divider', py: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          API keys stored in session memory only · Safe from server logs
        </Typography>
      </Box>

      {/* Session Expired Overlay */}
      {isSessionExpired && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,17,23,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 3, maxWidth: 400, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <LockIcon color="error" sx={{ fontSize: 40, mx: 'auto' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Session Expired</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              For your security, your session closed after 40 minutes of inactivity. API keys and data have been wiped.
            </Typography>
            <Button variant="contained" fullWidth onClick={() => window.location.reload()} sx={{ mt: 1 }}>
              Start New Session
            </Button>
          </Paper>
        </Box>
      )}

      {/* Print CSS */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
        @media print {
          body > * { visibility: hidden !important; }
          #resume-print-area, #resume-print-area * { visibility: visible !important; }
          #resume-print-area {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; max-width: 100% !important;
            box-shadow: none !important; border: none !important;
            padding: 0.75in !important; margin: 0 !important;
            background: white !important; color: black !important;
          }
          ins { background: none !important; color: black !important; text-decoration: none !important; }
          del { display: none !important; }
        }
      `}</style>
    </Box>
  );
}
