import React from 'react';
import Box from '@mui/material/Box';

interface OverlayProps {
  children: React.ReactNode;
  /** Opacity of the dark backdrop (0-1). */
  opacity?: number;
  /** Blur whatever is behind the backdrop. */
  blur?: boolean;
  /** Inner spacing (theme units), so content never touches the screen edge. */
  padding?: number;
  /** Called when the backdrop itself (not its content) is clicked. */
  onBackdropClick?: () => void;
  'data-testid'?: string;
}

/**
 * Full-screen dark backdrop that centres its content above everything else.
 * The app's modal dialogs use this instead of MUI Dialog.
 */
export default function Overlay({
  children,
  opacity = 0.92,
  blur = true,
  padding,
  onBackdropClick,
  'data-testid': testId,
}: OverlayProps) {
  return (
    <Box
      data-testid={testId}
      onClick={onBackdropClick}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: `rgba(15,17,23,${opacity})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        ...(blur && { backdropFilter: 'blur(4px)' }),
        ...(padding !== undefined && { p: padding }),
      }}
    >
      {children}
    </Box>
  );
}
