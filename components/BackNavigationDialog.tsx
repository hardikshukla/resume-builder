import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface BackNavigationDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Confirmation overlay shown when the user presses the browser back button
 * while a generated resume is active. Mirrors the session-expired overlay
 * pattern already used in page.tsx (fixed Box + Paper, no MUI Dialog import).
 */
export default function BackNavigationDialog({ open, onStay, onLeave }: BackNavigationDialogProps) {
  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15,17,23,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}
    >
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
    </Box>
  );
}
