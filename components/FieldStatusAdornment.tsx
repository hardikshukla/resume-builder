'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';

import { FieldStatus } from '@/types';

interface FieldStatusAdornmentProps {
  checking: boolean;
  status: FieldStatus | null;
  /** Describes what is being checked, e.g. "Anthropic API key". */
  label: string;
}

/**
 * Inline ✓ / ✗ / spinner shown inside a credential field.
 *
 * Credentials in this app are checked in the background rather than behind a
 * button, so the field itself has to report what happened. Renders nothing
 * until a check has actually run, so untouched fields stay quiet.
 */
export default function FieldStatusAdornment({ checking, status, label }: FieldStatusAdornmentProps) {
  if (checking) {
    return (
      <Tooltip title={`Checking ${label}…`}>
        <CircularProgress size={16} data-testid="field-status-checking" aria-label={`Checking ${label}`} />
      </Tooltip>
    );
  }

  if (!status) return null;

  return (
    <Tooltip title={status.message}>
      <Box
        component="span"
        data-testid={status.ok ? 'field-status-ok' : 'field-status-error'}
        role="status"
        aria-label={`${label}: ${status.message}`}
        sx={{ display: 'flex', color: status.ok ? 'success.main' : 'error.main' }}
      >
        {status.ok ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <ErrorOutlineIcon sx={{ fontSize: 18 }} />}
      </Box>
    </Tooltip>
  );
}
