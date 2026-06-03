import React, { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ApiErrorResponse } from '@/types/error';

interface ErrorBannerProps {
  error: ApiErrorResponse | null;
  onDismiss: () => void;
}

const TYPE_LABELS: Record<ApiErrorResponse['error']['type'], string> = {
  RATE_LIMIT: '⏳ Rate Limited',
  TIMEOUT: '⏱ Timeout / Overloaded',
  TOKEN_LIMIT: '📏 Input Too Long',
  VALIDATION_FAILED: '⚠️ Validation Error',
  FATAL: '❌ Error',
};

export default function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Initialise countdown whenever a new rate-limit error arrives
  useEffect(() => {
    if (error?.error.type === 'RATE_LIMIT' && error.error.retryAfterSeconds) {
      setSecondsLeft(error.error.retryAfterSeconds);
    } else {
      setSecondsLeft(null);
    }
  }, [error]);

  // Tick the countdown down every second
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  if (!error) return null;

  const isRateLimit = error.error.type === 'RATE_LIMIT';
  const severity = isRateLimit ? 'warning' : 'error';
  const label = TYPE_LABELS[error.error.type] ?? '❌ Error';

  return (
    <Alert
      severity={severity}
      onClose={onDismiss}
      sx={{ mb: 3 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="body2">
          {error.error.message}
        </Typography>
        {isRateLimit && secondsLeft !== null && (
          <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.85, mt: 0.5 }}>
            {secondsLeft > 0
              ? `Retry available in ${secondsLeft}s`
              : '✅ Ready to retry'}
          </Typography>
        )}
      </Box>
    </Alert>
  );
}
