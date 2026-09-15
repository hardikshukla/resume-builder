'use client';

import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { DROPBOX_APP_CONSOLE_URL } from '@/lib/constants';

interface DropboxSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

/** The two OAuth scopes this app actually calls. */
const REQUIRED_SCOPES: ReadonlyArray<{ scope: string; usedFor: string }> = [
  { scope: 'account_info.read', usedFor: 'Verify Token' },
  { scope: 'files.content.write', usedFor: 'uploading your .docx' },
];

/**
 * Setup steps for minting a personal Dropbox access token.
 *
 * Dropbox has no shared key — every user creates their own app — so these
 * steps are the app's only on-ramp to the Dropbox feature. Uses the fixed
 * Box + Paper overlay pattern of BackNavigationDialog rather than MUI Dialog,
 * and adds the Esc / backdrop dismissal that pattern otherwise lacks.
 */
export default function DropboxSetupDialog({ open, onClose }: DropboxSetupDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Box
      data-testid="dropbox-setup-backdrop"
      onClick={onClose}
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
        p: 2,
      }}
    >
      <Paper
        role="dialog"
        aria-modal="true"
        aria-labelledby="dropbox-setup-title"
        elevation={0}
        onClick={(e) => e.stopPropagation()}
        sx={{
          p: { xs: 3, sm: 4 },
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography id="dropbox-setup-title" variant="h6" sx={{ fontWeight: 700 }}>
              Connect Dropbox
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Dropbox has no shared key — you&apos;ll create your own app and generate a
              token from it. Takes about two minutes.
            </Typography>
          </Box>
          <IconButton ref={closeRef} onClick={onClose} aria-label="Close" size="small" disableFocusRipple>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Step
          number={1}
          title="Create your app"
          body="Create app → Scoped access → App folder, then give it any name. App folder keeps this app confined to its own folder in your Dropbox."
        >
          <Button
            variant="contained"
            size="small"
            href={DROPBOX_APP_CONSOLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            sx={{ mt: 1.5 }}
          >
            Open App Console
          </Button>
        </Step>

        <Step
          number={2}
          title="Set permissions first"
          body="On the Permissions tab, tick these two scopes and click Submit:"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1.5 }}>
            {REQUIRED_SCOPES.map(({ scope, usedFor }) => (
              <Box key={scope} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Box
                  component="code"
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 12,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.default',
                  }}
                >
                  {scope}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  for {usedFor}
                </Typography>
              </Box>
            ))}
          </Box>
          <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
            Do this <strong>before</strong> step 3. A token only carries the scopes that
            existed when it was generated — otherwise Verify Token fails with{' '}
            <Box component="code" sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
              missing_scope
            </Box>
            .
          </Alert>
        </Step>

        <Step
          number={3}
          title="Generate and paste"
          body="Back on the Settings tab, under OAuth 2 → Generated access token, click Generate. Paste the token into the panel and hit Verify Token."
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1.5 }}>
            Tokens expire by default. Set <strong>Access token expiration</strong> to
            &ldquo;No expiration&rdquo; first if you&apos;d rather not repeat this.
          </Typography>
        </Step>

        <Button variant="contained" onClick={onClose} sx={{ alignSelf: 'flex-end', mt: 0.5 }}>
          Got it
        </Button>
      </Paper>
    </Box>
  );
}

function Step({
  number,
  title,
  body,
  children,
}: {
  number: number;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: '50%',
          backgroundColor: 'primary.main',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          mt: 0.25,
        }}
      >
        {number}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          {body}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}
