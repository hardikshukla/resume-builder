'use client';

import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Outfit } from 'next/font/google';
import { APP_BACKGROUND, APP_PAPER } from '@/components/ui/tokens';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
});

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: APP_BACKGROUND,
      paper: APP_PAPER,
    },
    primary: {
      main: '#6C63FF',
    },
    success: {
      main: '#22c55e',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
  },
  components: {
    // Every text field and select sits on the page background rather than
    // the lighter paper colour of the panel around it.
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: APP_BACKGROUND },
      },
    },
  },
  typography: {
    fontFamily: outfit.style.fontFamily,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
