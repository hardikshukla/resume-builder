import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import { Recommendation } from '@/types';

interface RecommendationCardProps {
  rec: Recommendation;
  checked: boolean;
  applied: boolean;
  isCustom: boolean;
  onToggle: () => void;
}

export default function RecommendationCard({
  rec,
  checked,
  applied,
  isCustom,
  onToggle,
}: RecommendationCardProps) {
  return (
    <Box sx={{
      p: 2,
      mb: 1.5,
      borderRadius: 2,
      border: '1px solid',
      borderColor: checked ? 'warning.main' : 'divider',
      backgroundColor: checked ? 'rgba(237,108,2,0.02)' : '#161920',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1.5,
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: applied ? 'divider' : 'warning.main',
        backgroundColor: checked ? 'rgba(237,108,2,0.04)' : 'rgba(255,255,255,0.02)'
      }
    }}>
      <Checkbox
        checked={checked}
        onChange={onToggle}
        color="warning"
        disabled={applied}
        sx={{ p: 0, mt: 0.2 }}
      />
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="body2" sx={{
            fontWeight: 600,
            textDecoration: applied ? 'line-through' : 'none',
            color: applied ? 'success.main' : 'text.primary',
            opacity: applied ? 0.7 : 1
          }}>
            {rec.claim}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={isCustom ? 'CUSTOM' : rec.riskLevel.toUpperCase()}
              size="small"
              color={
                isCustom ? 'info' :
                rec.riskLevel === 'low' ? 'success' :
                rec.riskLevel === 'medium' ? 'warning' : 'error'
              }
              variant="outlined"
              sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }}
            />
            
            {applied && (
              <Chip
                label="APPLIED"
                size="small"
                color="success"
                sx={{ fontSize: '0.65rem', height: 18, fontWeight: 700 }}
              />
            )}
          </Box>
        </Box>
        
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
          <strong>Target Section:</strong> {rec.targetSection}
        </Typography>
        
        {!isCustom && (
          <Box sx={{ mt: 0.5, p: 1, borderRadius: 1, backgroundColor: '#0f1117', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
              <strong>Evidence Required:</strong> {rec.evidenceRequired}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem', mt: 0.2 }}>
              <strong>Evidence Found:</strong> {rec.evidenceFound || 'None'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
