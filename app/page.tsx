'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GitHubIcon from '@mui/icons-material/GitHub';
import LockIcon from '@mui/icons-material/Lock';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { useApiKey } from '@/hooks/useApiKey';
import { Recommendation } from '@/types';
import { useGenerate } from '@/hooks/useGenerate';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { buildDownloadFilename } from '@/lib/utils/string';
import { MAX_RESUME_CHARS, MAX_JD_CHARS, RESUME_WARN_CHARS, JD_WARN_CHARS, DEFAULT_MODELS } from '@/lib/constants';
import GapAnalysisPanel from '@/components/GapAnalysisPanel';
import ResumePreview from '@/components/ResumePreview';
import CoverLetterPreview from '@/components/CoverLetterPreview';
import ErrorBanner from '@/components/ErrorBanner';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import { WorkflowStepper } from '@/components/WorkflowStepper';
import { ContextPill } from '@/components/ContextPill';

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
    jdKeywords,
    isLoading,
    error,
    clearError,
    handleGenerate,
    handleRefine,
    handleRevert,
    handleRefreshRecommendations,
    manualEdits,
    orphanedEdits,
    clearOrphanedEdits,
    handleManualEdit,
  } = useGenerate();

  const [activeTab, setActiveTab] = useState(0);
  const [showHighlights, setShowHighlights] = useState(true);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [appliedRecs, setAppliedRecs] = useState<Set<string>>(new Set());
  const [customRecommendations, setCustomRecommendations] = useState<Recommendation[]>([]);
  const [customRecText, setCustomRecText] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showDropboxToken, setShowDropboxToken] = useState(false);
  const [dropboxStatus, setDropboxStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [isVerifyingDropbox, setIsVerifyingDropbox] = useState(false);
  const [dropboxVerifyStatus, setDropboxVerifyStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');

  const [activeStep, setActiveStep] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const handleStepChange = (step: number) => {
    setActiveStep(step);
    if (step === 0 || step === 1) {
      if (isMobile) {
        setDrawerOpen(true);
      }
    } else {
      if (isMobile) {
        setDrawerOpen(false);
      }
    }
  };

  const handleGenerateClick = async () => {
    setActiveStep(1);
    if (isMobile) {
      setDrawerOpen(false);
    }
    await handleGenerate(anthropicKey);
  };

  useEffect(() => {
    if (output) {
      setActiveStep(2);
    } else {
      setActiveStep(0);
    }
  }, [output]);

  // Reset recommendations selection, applied status, and custom recommendations when JD, resume, or a fresh generation changes
  useEffect(() => {
    setSelectedRecs([]);
    setAppliedRecs(new Set());
    setCustomRecommendations([]);
    setCustomRecText('');
  }, [jobDescription, resume, originalOutput]);

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
        throw new Error(data.error?.message || data.error || 'Failed to parse resume file.');
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
        const errMsg = typeof data.error === 'object' && data.error ? data.error.message : (data.error || 'Verification failed.');
        setDropboxVerifyStatus({ success: false, message: errMsg });
      }
    } catch (err) {
      console.error('Dropbox token verification error:', err);
      setDropboxVerifyStatus({ success: false, message: 'Server verification failed.' });
    } finally {
      setIsVerifyingDropbox(false);
    }
  };

  // Inactivity session lock (40 min) using custom hook
  useInactivityTimeout(40, () => {
    sessionStorage.clear();
    setIsSessionExpired(true);
  });

  useEffect(() => {
    const clearOnUnload = () => sessionStorage.clear();
    window.addEventListener('beforeunload', clearOnUnload);
    return () => window.removeEventListener('beforeunload', clearOnUnload);
  }, []);

  // Get all unique keywords for bolding (strongMatches, clean version of keywordsAdded, JD keywords, and applied recommendations)
  const boldingKeywords = useMemo(() => {
    if (!output) return [];
    const keywords = new Set<string>();
    
    // 1. Initial strong matches
    output.gapAnalysis.strongMatches.forEach(kw => {
      if (kw) keywords.add(kw.trim());
    });
    
    // 2. Keywords added during initial tailoring
    output.gapAnalysis.keywordsAdded.forEach(kw => {
      if (kw) {
        const clean = kw.replace(/ \([^)]+\)$/, '').trim();
        if (clean) keywords.add(clean);
      }
    });

    // 3. All JD keywords (must-have and nice-to-have skills)
    if (jdKeywords) {
      jdKeywords.mustHaveSkills.forEach(kw => {
        if (kw) keywords.add(kw.trim());
      });
      jdKeywords.niceToHaveSkills.forEach(kw => {
        if (kw) keywords.add(kw.trim());
      });
    }

    // 4. Keywords from applied recommendations
    if (output.gapAnalysis.recommendations) {
      output.gapAnalysis.recommendations.forEach(rec => {
        if (appliedRecs.has(rec.id)) {
          // Extract capitalized words from the recommendation claim (excluding common verbs/prepositions/nouns)
          const words = rec.claim.split(/[\s,.:;()'"?]+/);
          words.forEach(w => {
            const trimmed = w.trim();
            if (trimmed && /^[A-Z]/.test(trimmed)) {
              const lower = trimmed.toLowerCase();
              const exclusions = new Set([
                'add', 'consider', 'under', 'skills', 'experience', 'summary', 
                'projects', 'mention', 'use', 'include', 'integrate', 'create', 
                'update', 'modify', 'show', 'display', 'highlight', 'demonstrate', 
                'provide', 'list', 'write', 'in', 'to', 'the', 'as', 'for', 'with',
                'and', 'or', 'a', 'an', 'at', 'on', 'by'
              ]);
              if (!exclusions.has(lower)) {
                keywords.add(trimmed);
              }
            }
          });
        }
      });
    }

    // Sort descending by length so longer phrases match before shorter substrings
    return Array.from(keywords).sort((a, b) => b.length - a.length);
  }, [output, jdKeywords, appliedRecs]);

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
        blob = await generateResumeDOCX(output.resume, boldingKeywords);
      } else {
        if (!output.coverLetter) throw new Error('No cover letter available');
        blob = await generateCoverLetterDOCX(output.coverLetter, output.resume, getCompanyStr(), boldingKeywords);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setActiveStep(3);
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
        blob = await generateResumeDOCX(output.resume, boldingKeywords);
      } else {
        if (!output.coverLetter) throw new Error('No cover letter available');
        blob = await generateCoverLetterDOCX(output.coverLetter, output.resume, co, boldingKeywords);
      }
      const folderName = (co || 'Tailored').replace(/[^a-z0-9]/gi, '_');
      const path = `/resumeBuilder/${folderName}/${filename}`;
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
      setActiveStep(3);
    } catch (err) {
      setDropboxStatus({ type: 'error', message: err instanceof Error ? err.message : 'Dropbox failed.' });
    }
  };

  const getCharColor = (count: number, limit: number, warn: number) => {
    if (count > limit) return 'error.main';
    if (count > warn) return 'warning.main';
    return 'text.secondary';
  };

  const renderInputs = () => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: isMobile ? 'none' : '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        backgroundColor: '#0f1117',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Tailoring Parameters
        </Typography>
        {isMobile && (
          <Button onClick={() => setDrawerOpen(false)} variant="text" size="small">
            Close
          </Button>
        )}
      </Box>

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
        label={hasServerKey ? 'Anthropic API Key (Configured on Server)' : 'Anthropic API Key (Mandatory)'}
        type={showAnthropicKey ? 'text' : 'password'} fullWidth
        value={hasServerKey ? '' : anthropicKey}
        onChange={(e) => setAnthropicKey(e.target.value)}
        placeholder={hasServerKey ? 'Configured on server via environment variable.' : 'Enter your Anthropic API Key...'}
        disabled={hasServerKey}
        error={!hasServerKey && !anthropicKey}
        helperText={!hasServerKey && !anthropicKey ? 'Anthropic API Key is required to run LLM operations.' : ''}
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
        </Select>
      </FormControl>

      {/* Dropbox (Optional) */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <TextField
          label="Dropbox Access Token (Optional)"
          type={showDropboxToken ? 'text' : 'password'} fullWidth
          value={dropboxToken || ''}
          onChange={(e) => setDropboxToken(e.target.value)}
          placeholder="Enter Dropbox Access Token..."
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

      {/* Generate Button */}
      <Button variant="contained" size="large" fullWidth
        onClick={handleGenerateClick}
        disabled={isLoading || resume.length === 0 || jobDescription.length === 0 || resume.length > MAX_RESUME_CHARS || jobDescription.length > MAX_JD_CHARS || (!hasServerKey && !anthropicKey)}
        sx={{ background: 'linear-gradient(135deg, #6c63ff, #a855f7)', boxShadow: '0 4px 20px rgba(108,99,255,0.4)', py: 1.5, '&:hover': { background: 'linear-gradient(135deg, #5b54e5, #9546e5)' } }}>
        {isLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '✨ Generate Tailored Resume'}
      </Button>

      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        API keys stored in session only · Never logged server-side
      </Typography>
    </Paper>
  );

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
        <WorkflowStepper
          activeStep={activeStep}
          isLoading={isLoading}
          hasOutput={!!output}
          onStepChange={handleStepChange}
        />

        <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Left Panel (Inputs) ────────────────────────────────── */}
          {!isMobile && (
            <Box sx={{ flex: '0 0 auto', width: '350px' }}>
              <Box sx={{ position: 'sticky', top: 80, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                {renderInputs()}
              </Box>
            </Box>
          )}

          {isMobile && (
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              slotProps={{
                paper: {
                  sx: {
                    width: '320px',
                    backgroundColor: '#0f1117',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                  },
                },
              }}
            >
              {renderInputs()}
            </Drawer>
          )}

          {isMobile && (
            <Fab
              color="primary"
              aria-label="edit parameters"
              onClick={() => setDrawerOpen(true)}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 1000,
                background: 'linear-gradient(135deg, #6c63ff, #a855f7)',
              }}
            >
              <SettingsIcon />
            </Fab>
          )}

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
            {error && !isLoading && (
              <ErrorBanner error={error} onDismiss={clearError} />
            )}

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
                <ContextPill
                  model={selectedModel}
                  matchScore={output.gapAnalysis.matchScore}
                  editCount={manualEdits.length}
                  appliedRecsCount={appliedRecs.size}
                />

                {/* Refined banner */}
                {originalOutput && output !== originalOutput && (
                  <Paper elevation={0} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(108,99,255,0.08)', border: '1px solid', borderColor: 'primary.main', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      💡 Refined · Score: {originalOutput.gapAnalysis.matchScore}% → {output.gapAnalysis.matchScore}%
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => {
                      handleRevert();
                      setAppliedRecs(new Set());
                      setSelectedRecs([]);
                    }}>Revert to Original</Button>
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
                  <GapAnalysisPanel
                    output={output}
                    jdKeywords={jdKeywords}
                    anthropicKey={anthropicKey}
                    hasServerKey={hasServerKey}
                    isLoading={isLoading}
                    handleRefreshRecommendations={handleRefreshRecommendations}
                    handleRefine={handleRefine}
                    selectedRecs={selectedRecs}
                    setSelectedRecs={setSelectedRecs}
                    appliedRecs={appliedRecs}
                    setAppliedRecs={setAppliedRecs}
                    customRecommendations={customRecommendations}
                    setCustomRecommendations={setCustomRecommendations}
                    customRecText={customRecText}
                    setCustomRecText={setCustomRecText}
                  />
                )}

                {/* ── Tab 1: Tailored Resume ──────────────────────── */}
                {activeTab === 1 && (
                  <ResumePreview
                    output={output}
                    originalOutput={originalOutput}
                    showHighlights={showHighlights}
                    setShowHighlights={setShowHighlights}
                    boldingKeywords={boldingKeywords}
                    dropboxToken={dropboxToken}
                    dropboxStatus={dropboxStatus}
                    setDropboxStatus={setDropboxStatus}
                    handleDownload={handleDownload}
                    handleSaveToDropbox={handleSaveToDropbox}
                    handleManualEdit={handleManualEdit}
                    manualEdits={manualEdits}
                    orphanedEdits={orphanedEdits}
                    clearOrphanedEdits={clearOrphanedEdits}
                  />
                )}

                {/* ── Tab 2: Cover Letter ─────────────────────────── */}
                {activeTab === 2 && (
                  <CoverLetterPreview
                    output={output}
                    originalOutput={originalOutput}
                    showHighlights={showHighlights}
                    setShowHighlights={setShowHighlights}
                    boldingKeywords={boldingKeywords}
                    dropboxToken={dropboxToken}
                    dropboxStatus={dropboxStatus}
                    setDropboxStatus={setDropboxStatus}
                    handleDownload={handleDownload}
                    handleSaveToDropbox={handleSaveToDropbox}
                    handleManualEdit={handleManualEdit}
                    manualEdits={manualEdits}
                    orphanedEdits={orphanedEdits}
                    clearOrphanedEdits={clearOrphanedEdits}
                  />
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
      <style dangerouslySetInnerHTML={{ __html: `
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
      ` }} />
    </Box>
  );
}
