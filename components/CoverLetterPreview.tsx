import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ResumeBuilderOutput } from '@/types';
import { renderDiffText } from '@/lib/utils/highlight';
import { capitalizeName } from '@/lib/utils/string';
import { EditableField } from './EditableField';

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

const BODY_TEXT_SX = {
  fontFamily: '"Times New Roman"',
  fontSize: '11pt',
};

interface CoverLetterPreviewProps {
  output: ResumeBuilderOutput;
  originalOutput: ResumeBuilderOutput | null;
  showHighlights: boolean;
  setShowHighlights: (checked: boolean) => void;
  boldingKeywords: string[];
  dropboxToken: string | null;
  dropboxStatus: { type: 'success' | 'error'; message: string } | null;
  setDropboxStatus: (status: { type: 'success' | 'error'; message: string } | null) => void;
  handleDownload: (type: 'resume' | 'coverLetter') => void;
  handleSaveToDropbox: (type: 'resume' | 'coverLetter') => void;
  handleManualEdit: (path: string, value: string) => void;
  manualEdits: { path: string; originalValue: string; editedValue: string }[];
  orphanedEdits: { path: string; originalValue: string; editedValue: string }[];
  clearOrphanedEdits: (prefix?: 'resume' | 'coverLetter') => void;
}

export default function CoverLetterPreview({
  output,
  originalOutput,
  showHighlights,
  setShowHighlights,
  boldingKeywords,
  dropboxToken,
  dropboxStatus,
  setDropboxStatus,
  handleDownload,
  handleSaveToDropbox,
  handleManualEdit,
  manualEdits,
  orphanedEdits,
  clearOrphanedEdits,
}: CoverLetterPreviewProps) {
  const renderDiff = (original: string | undefined, current: string) => {
    return renderDiffText(original, current, showHighlights, boldingKeywords);
  };

  const coverLetterOrphans = useMemo(() => {
    return orphanedEdits.filter((e) => e.path.startsWith('coverLetter'));
  }, [orphanedEdits]);

  return (
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

      {coverLetterOrphans && coverLetterOrphans.length > 0 && (
        <Alert severity="warning" onClose={() => clearOrphanedEdits('coverLetter')} sx={{ mb: 2 }}>
          <strong>⚠️ Unapplied Cover Letter Edits:</strong> The following manual edit(s) could not be automatically merged because the content was significantly rewritten during refinement:
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {coverLetterOrphans.map((edit, idx) => {
              const bodyMatch = edit.path.match(/\[(\d+)\]$/);
              const name = bodyMatch ? `Paragraph ${parseInt(bodyMatch[1], 10) + 1}` : edit.path;
              return (
                <Box component="li" key={idx} sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                  At {name}: <em>&ldquo;{edit.editedValue}&rdquo;</em>
                </Box>
              );
            })}
          </Box>
        </Alert>
      )}

      {output.coverLetter ? (
        <Box sx={A4_STYLES}>
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
          <Typography sx={{ ...BODY_TEXT_SX, mt: 3, mb: 2 }}>
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </Typography>
          <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, mb: 2 }}>
            <EditableField
              path="coverLetter.subject"
              value={output.coverLetter.subject}
              onSave={handleManualEdit}
              isEdited={manualEdits.some(e => e.path === 'coverLetter.subject')}
            >
              Subject: {output.coverLetter.subject}
            </EditableField>
          </Typography>
          <Typography sx={{ ...BODY_TEXT_SX, mb: 2 }}>Dear Hiring Manager,</Typography>
          {output.coverLetter.body.split(/\n+/).filter(Boolean).map((para, i) => (
            <Typography key={i} sx={{ ...BODY_TEXT_SX, textAlign: 'justify', mb: 1.5 }}>
              <EditableField
                path={`coverLetter.body[${i}]`}
                value={para}
                multiline
                onSave={handleManualEdit}
                isEdited={manualEdits.some(e => e.path === `coverLetter.body[${i}]`)}
              >
                {renderDiff(originalOutput?.coverLetter?.body.split(/\n+/).filter(Boolean)[i], para)}
              </EditableField>
            </Typography>
          ))}
          <Typography sx={{ ...BODY_TEXT_SX, mt: 3 }}>Sincerely,</Typography>
          <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, mt: 3 }}>
            {output.resume.name ? capitalizeName(output.resume.name) : 'Candidate Name'}
          </Typography>
        </Box>
      ) : (
        <Alert severity="warning">
          Cover letter was not generated this round. Use Apply &amp; Refine to trigger it.
        </Alert>
      )}
    </Box>
  );
}
