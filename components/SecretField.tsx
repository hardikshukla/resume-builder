'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FieldStatusAdornment from '@/components/FieldStatusAdornment';
import { FieldStatus } from '@/types';

type SecretFieldProps = Omit<TextFieldProps, 'type' | 'slotProps' | 'label'> & {
  label: string;
  /** Background check state shown as ✓ / ✗ / spinner inside the field. */
  checking?: boolean;
  status?: FieldStatus | null;
  /** Hide the check indicator entirely (e.g. when the server holds the key). */
  hideStatus?: boolean;
};

/**
 * A masked text field for an API key or token, with a show/hide toggle and an
 * inline indicator for the background validity check.
 */
export default function SecretField({
  label,
  checking = false,
  status = null,
  hideStatus = false,
  disabled,
  ...textFieldProps
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TextField
      {...textFieldProps}
      label={label}
      disabled={disabled}
      type={revealed ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {!hideStatus && <FieldStatusAdornment checking={checking} status={status} label={label} />}
                <IconButton
                  onClick={() => setRevealed((shown) => !shown)}
                  edge="end"
                  disabled={disabled}
                  aria-label={`${revealed ? 'Hide' : 'Show'} ${label}`}
                >
                  {revealed ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </Box>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
