import React from 'react';
import Typography from '@mui/material/Typography';

interface CharCountProps {
  count: number;
  limit: number;
  /** Count above which the counter turns amber, before it turns red at `limit`. */
  warnAt: number;
}

/** "1,234 / 15,000 chars", right-aligned, coloured as the limit approaches. */
export default function CharCount({ count, limit, warnAt }: CharCountProps) {
  const color = count > limit ? 'error.main' : count > warnAt ? 'warning.main' : 'text.secondary';
  return (
    <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, color }}>
      {count.toLocaleString()} / {limit.toLocaleString()} chars
    </Typography>
  );
}
