import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Overlay from '@/components/ui/Overlay';

interface BackNavigationDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Confirmation overlay shown when the user presses the browser back button
 * while a generated resume is active. Mirrors the session-expired overlay
 * pattern used by the app's other dialogs (shared Overlay + Paper, no MUI Dialog).
 */
export default function BackNavigationDialog({ open, onStay, onLeave }: BackNavigationDialogProps) {
  if (!open) return null;

  return (
    <Overlay>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: '1px solid',
          borderColor: 'warning.main',
          borderRadius: 3,
          maxWidth: 440,
          width: '90%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <WarningAmberIcon color="warning" sx={{ fontSize: 48 }} />

        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Leave this page?
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          You have a generated resume and cover letter. Going back will{' '}
          <strong>permanently lose all your work</strong> — including edits,
          applied recommendations, and tailored content.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', mt: 1 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={onStay}
            sx={{ fontWeight: 700 }}
          >
            Stay on Page
          </Button>
          <Button
            variant="outlined"
            color="error"
            fullWidth
            size="large"
            onClick={onLeave}
          >
            Leave &amp; Lose Work
          </Button>
        </Box>
      </Paper>
    </Overlay>
  );
}
