import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { DropboxSaveStatus, ManualEdit, ResumeBuilderOutput } from '@/types';
import { renderDiffText } from '@/lib/utils/highlight';
import { contactParts } from '@/lib/utils/contact';
import { capitalizeName } from '@/lib/utils/string';
import { EditableField } from './EditableField';
import {
  BODY_TEXT_SX,
  DropboxSaveAlert,
  LETTER_PAGE_SX,
  PreviewToolbar,
  UnappliedEditsAlert,
} from './preview/PreviewParts';

/** "coverLetter.body[1]" -> "Paragraph 2"; other paths are shown as-is. */
function describeCoverLetterLocation(edit: ManualEdit): string {
  const match = edit.path.match(/\[(\d+)\]$/);
  return match ? `Paragraph ${parseInt(match[1], 10) + 1}` : edit.path;
}


interface CoverLetterPreviewProps {
  output: ResumeBuilderOutput;
  originalOutput: ResumeBuilderOutput | null;
  showHighlights: boolean;
  setShowHighlights: (checked: boolean) => void;
  boldingKeywords: string[];
  dropboxToken: string | null;
  dropboxSaveStatus: DropboxSaveStatus | null;
  setDropboxSaveStatus: (status: DropboxSaveStatus | null) => void;
  handleDownload: (type: 'resume' | 'coverLetter') => void;
  handleSaveToDropbox: (type: 'resume' | 'coverLetter') => void;
  handleManualEdit: (path: string, value: string) => void;
  manualEdits: ManualEdit[];
  orphanedEdits: ManualEdit[];
  clearOrphanedEdits: (prefix?: 'resume' | 'coverLetter') => void;
}

export default function CoverLetterPreview({
  output,
  originalOutput,
  showHighlights,
  setShowHighlights,
  boldingKeywords,
  dropboxToken,
  dropboxSaveStatus,
  setDropboxSaveStatus,
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
      <PreviewToolbar showHighlights={showHighlights} onShowHighlightsChange={setShowHighlights}>
        <Button startIcon={<ContentCopyIcon />} variant="outlined" size="small"
          onClick={() => { if (output.coverLetter) { navigator.clipboard.writeText(output.coverLetter.body); } }}>
          Copy Body
        </Button>
        <Button startIcon={<DownloadIcon />} variant="outlined" size="small" onClick={() => handleDownload('coverLetter')}>Download DOCX</Button>
        {dropboxToken && (
          <Button startIcon={<CloudUploadIcon />} variant="outlined" color="primary" size="small" onClick={() => handleSaveToDropbox('coverLetter')}>Save to Dropbox</Button>
        )}
      </PreviewToolbar>

      <DropboxSaveAlert status={dropboxSaveStatus} onClose={() => setDropboxSaveStatus(null)} />

      <UnappliedEditsAlert
        title="⚠️ Unapplied Cover Letter Edits:"
        edits={coverLetterOrphans}
        describeLocation={describeCoverLetterLocation}
        onClose={() => clearOrphanedEdits('coverLetter')}
      />

      {output.coverLetter ? (
        <Box sx={LETTER_PAGE_SX}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, fontSize: '14pt', textTransform: 'uppercase' }}>
              {output.resume.name || 'Candidate Name'}
            </Typography>
            <Typography sx={{ ...BODY_TEXT_SX, mt: 0.5 }}>
              {/* Same shortened links as the Word export, so preview and download match. */}
              {contactParts(output.resume.contact, { shortenUrls: true }).join('  |  ')}
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
