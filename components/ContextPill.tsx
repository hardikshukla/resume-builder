import React from 'react';
import { Chip, Paper, useTheme } from '@mui/material';
import ModelIcon from '@mui/icons-material/Psychology';
import ScoreIcon from '@mui/icons-material/Speed';
import EditIcon from '@mui/icons-material/Edit';
import AppliedIcon from '@mui/icons-material/CheckCircle';

interface ContextPillProps {
  model: string;
  matchScore: number;
  editCount: number;
  appliedRecsCount: number;
}

export const ContextPill: React.FC<ContextPillProps> = ({
  model,
  matchScore,
  editCount,
  appliedRecsCount,
}) => {
  const theme = useTheme();

  const getScoreColor = (score: number) => {
    if (score >= 75) {
      return {
        bg: 'rgba(46, 125, 50, 0.08)',
        text: '#2e7d32',
        border: '1px solid rgba(46, 125, 50, 0.2)',
      };
    }
    if (score >= 50) {
      return {
        bg: 'rgba(237, 108, 2, 0.08)',
        text: '#ed6c02',
        border: '1px solid rgba(237, 108, 2, 0.2)',
      };
    }
    return {
      bg: 'rgba(211, 47, 47, 0.08)',
      text: '#d32f2f',
      border: '1px solid rgba(211, 47, 47, 0.2)',
    };
  };

  const scoreColors = getScoreColor(matchScore);

  const friendlyModelName = (modelId: string) => {
    if (modelId.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet';
    if (modelId.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
    if (modelId.includes('claude-haiku-4-5')) return 'Claude Haiku 4.5';
    if (modelId.includes('claude-3-5-haiku')) return 'Claude 3.5 Haiku';
    return modelId;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 1.5,
        p: 0.75,
        px: 1.5,
        borderRadius: 16,
        background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        backdropFilter: 'blur(8px)',
        alignItems: 'center',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        mb: 2,
        width: 'fit-content',
      }}
    >
      <Chip
        icon={<ModelIcon style={{ fontSize: 16 }} />}
        label={`Model: ${friendlyModelName(model)}`}
        size="small"
        sx={{
          background: 'rgba(103, 58, 183, 0.08)',
          color: '#673ab7',
          border: '1px solid rgba(103, 58, 183, 0.2)',
          fontWeight: 500,
          '& .MuiChip-icon': { color: '#673ab7' },
        }}
      />
      <Chip
        icon={<ScoreIcon style={{ fontSize: 16 }} />}
        label={`ATS Score: ${matchScore}%`}
        size="small"
        sx={{
          background: scoreColors.bg,
          color: scoreColors.text,
          border: scoreColors.border,
          fontWeight: 600,
          '& .MuiChip-icon': { color: scoreColors.text },
        }}
      />
      <Chip
        icon={<EditIcon style={{ fontSize: 16 }} />}
        label={`${editCount} edit${editCount !== 1 ? 's' : ''}`}
        size="small"
        sx={{
          background: editCount > 0 ? 'rgba(2, 136, 209, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          color: editCount > 0 ? '#0288d1' : 'text.secondary',
          border: '1px solid',
          borderColor: editCount > 0 ? 'rgba(2, 136, 209, 0.2)' : 'transparent',
          fontWeight: 500,
          '& .MuiChip-icon': { color: editCount > 0 ? '#0288d1' : 'inherit' },
        }}
      />
      <Chip
        icon={<AppliedIcon style={{ fontSize: 16 }} />}
        label={`${appliedRecsCount} rec${appliedRecsCount !== 1 ? 's' : ''} applied`}
        size="small"
        sx={{
          background: appliedRecsCount > 0 ? 'rgba(0, 150, 136, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          color: appliedRecsCount > 0 ? '#009688' : 'text.secondary',
          border: '1px solid',
          borderColor: appliedRecsCount > 0 ? 'rgba(0, 150, 136, 0.2)' : 'transparent',
          fontWeight: 500,
          '& .MuiChip-icon': { color: appliedRecsCount > 0 ? '#009688' : 'inherit' },
        }}
      />
    </Paper>
  );
};
