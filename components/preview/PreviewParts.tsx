/**
 * PreviewParts.tsx — pieces shared by the resume and cover letter previews.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { DropboxSaveStatus, ManualEdit } from '@/types';

/** A white US Letter sheet (8.5in x 11in) that mirrors the Word export. */
export const LETTER_PAGE_SX = {
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

/** Body text on the sheet: Times New Roman 11pt, like the export. */
export const BODY_TEXT_SX = {
  fontFamily: '"Times New Roman"',
  fontSize: '11pt',
};

interface PreviewToolbarProps {
  showHighlights: boolean;
  onShowHighlightsChange: (checked: boolean) => void;
  /** Action buttons shown on the right (download, save, print, …). */
  children: React.ReactNode;
}

/** "Show Highlights" switch on the left, the tab's actions on the right. */
export function PreviewToolbar({ showHighlights, onShowHighlightsChange, children }: PreviewToolbarProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
      <FormControlLabel
        control={<Switch checked={showHighlights} onChange={(e) => onShowHighlightsChange(e.target.checked)} color="success" />}
        label="Show Highlights"
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{children}</Box>
    </Box>
  );
}

/** Result of the last "Save to Dropbox", dismissible. Renders nothing when there is none. */
export function DropboxSaveAlert({ status, onClose }: { status: DropboxSaveStatus | null; onClose: () => void }) {
  if (!status) return null;
  return <Alert severity={status.type} onClose={onClose}>{status.message}</Alert>;
}

interface UnappliedEditsAlertProps {
  /** Bold lead-in, e.g. "⚠️ Unapplied Edits:". */
  title: string;
  edits: ManualEdit[];
  /** Where the edit was, as shown to the user. */
  describeLocation: (edit: ManualEdit) => React.ReactNode;
  onClose: () => void;
}

/**
 * Lists manual edits a refine could not carry over, because the text they
 * replaced was rewritten too much. Renders nothing when there are none.
 */
export function UnappliedEditsAlert({ title, edits, describeLocation, onClose }: UnappliedEditsAlertProps) {
  if (edits.length === 0) return null;
  return (
    <Alert severity="warning" onClose={onClose} sx={{ mb: 2 }}>
      <strong>{title}</strong> The following manual edit(s) could not be automatically merged because the content was significantly rewritten during refinement:
      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
        {edits.map((edit, idx) => (
          <Box component="li" key={idx} sx={{ fontSize: '0.85rem', mt: 0.5 }}>
            At {describeLocation(edit)}: <em>&ldquo;{edit.editedValue}&rdquo;</em>
          </Box>
        ))}
      </Box>
    </Alert>
  );
}
