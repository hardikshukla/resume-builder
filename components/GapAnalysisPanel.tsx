import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import AutorenewIcon from '@mui/icons-material/Autorenew';

import { ResumeBuilderOutput, Recommendation, JDExtractionResult } from '@/types';
import RecommendationCard from './RecommendationCard';

interface GapAnalysisPanelProps {
  output: ResumeBuilderOutput;
  jdKeywords: JDExtractionResult | null;
  anthropicKey: string;
  hasServerKey: boolean;
  isLoading: boolean;
  handleRefreshRecommendations: (key?: string) => Promise<boolean>;
  handleRefine: (selectedRecs: Recommendation[], key: string) => Promise<boolean>;
  selectedRecs: string[];
  setSelectedRecs: React.Dispatch<React.SetStateAction<string[]>>;
  appliedRecs: Set<string>;
  setAppliedRecs: React.Dispatch<React.SetStateAction<Set<string>>>;
  customRecommendations: Recommendation[];
  setCustomRecommendations: React.Dispatch<React.SetStateAction<Recommendation[]>>;
  customRecText: string;
  setCustomRecText: (text: string) => void;
}

export default function GapAnalysisPanel({
  output,
  jdKeywords,
  anthropicKey,
  hasServerKey,
  isLoading,
  handleRefreshRecommendations,
  handleRefine,
  selectedRecs,
  setSelectedRecs,
  appliedRecs,
  setAppliedRecs,
  customRecommendations,
  setCustomRecommendations,
  customRecText,
  setCustomRecText,
}: GapAnalysisPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Deduplication & calculations
  const uniqueStrongMatches = Array.from(new Set(output.gapAnalysis.strongMatches));
  const uniqueKeywordsAdded = Array.from(new Set(output.gapAnalysis.keywordsAdded));
  const uniqueDealbreakers = Array.from(
    new Map(output.gapAnalysis.dealbreakers.map((db) => [db.text, db])).values()
  );
  const uniqueRecommendations = Array.from(
    new Map(output.gapAnalysis.recommendations.map((r) => [r.claim, r])).values()
  );
  const allRecommendations = [...uniqueRecommendations, ...customRecommendations];

  const isDealbreakerResolved = (dbId: string) =>
    selectedRecs.some((recId) => {
      const rec = output.gapAnalysis.recommendations.find((r) => r.id === recId);
      return rec?.resolvesDealbreakers.includes(dbId);
    });

  const handleRecToggle = (recId: string) => {
    setSelectedRecs((prev) =>
      prev.includes(recId) ? prev.filter((id) => id !== recId) : [...prev, recId]
    );
  };

  return (
    <Box id="tabpanel-gap" role="tabpanel" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>

        {/* Match Score */}
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>ATS Keyword Match Score</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <LinearProgress variant="determinate" value={output.gapAnalysis.matchScore}
            sx={{ flexGrow: 1, height: 10, borderRadius: 5 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', minWidth: 50 }}>
            {output.gapAnalysis.matchScore}%
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Placement-weighted coverage (Summary &amp; Skills score higher). Deducts 5 pts per unresolved dealbreaker. Capped at 95.
        </Typography>

        {/* Score Breakdown Stacked Bar Chart */}
        {output.gapAnalysis.scoreBreakdown && (
          <Box sx={{ mt: 1.5, mb: 3 }}>
            <Box sx={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
              {output.gapAnalysis.scoreBreakdown.summary > 0 && (
                <Box sx={{
                  width: `${(output.gapAnalysis.scoreBreakdown.summary / 85) * 100}%`,
                  backgroundColor: 'primary.main',
                  height: '100%',
                }} title={`Summary: ${output.gapAnalysis.scoreBreakdown.summary}/25`} />
              )}
              {output.gapAnalysis.scoreBreakdown.skills > 0 && (
                <Box sx={{
                  width: `${(output.gapAnalysis.scoreBreakdown.skills / 85) * 100}%`,
                  backgroundColor: 'success.main',
                  height: '100%',
                }} title={`Skills: ${output.gapAnalysis.scoreBreakdown.skills}/30`} />
              )}
              {output.gapAnalysis.scoreBreakdown.experience > 0 && (
                <Box sx={{
                  width: `${(output.gapAnalysis.scoreBreakdown.experience / 85) * 100}%`,
                  backgroundColor: 'warning.main',
                  height: '100%',
                }} title={`Experience: ${output.gapAnalysis.scoreBreakdown.experience}/30`} />
              )}
            </Box>
            
            {/* Legend / Labels */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  Summary ({output.gapAnalysis.scoreBreakdown.summary}/25)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'success.main' }} />
                <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  Skills ({output.gapAnalysis.scoreBreakdown.skills}/30)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'warning.main' }} />
                <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  Experience ({output.gapAnalysis.scoreBreakdown.experience}/30)
                </Typography>
              </Box>
              {output.gapAnalysis.scoreBreakdown.dealbreakersDeducted > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'error.main', fontWeight: 600 }}>
                    -{output.gapAnalysis.scoreBreakdown.dealbreakersDeducted} pts (dealbreakers)
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}


        {/* Job Description Analysis (Pre-extracted keywords) */}
        {jdKeywords && (
          <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon color="secondary" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  🔍 Job Description Analysis (Haiku Extracted)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Typography variant="body2">
                  <strong>Seniority:</strong> {jdKeywords.seniority || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Company:</strong> {jdKeywords.companyName || 'N/A'}
                </Typography>
              </Box>
              
              {jdKeywords.mustHaveSkills && jdKeywords.mustHaveSkills.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary', fontWeight: 600 }}>
                    MUST-HAVE SKILLS
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {jdKeywords.mustHaveSkills.map((sk) => (
                      <Chip key={sk} label={sk} size="small" variant="outlined" color="primary" />
                    ))}
                  </Box>
                </Box>
              )}
              
              {jdKeywords.niceToHaveSkills && jdKeywords.niceToHaveSkills.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary', fontWeight: 600 }}>
                    NICE-TO-HAVE SKILLS
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {jdKeywords.niceToHaveSkills.map((sk) => (
                      <Chip key={sk} label={sk} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {jdKeywords.gapsDetected && jdKeywords.gapsDetected.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary', fontWeight: 600 }}>
                    GAPS DETECTED
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '0.85rem', color: 'text.secondary' }}>
                    {jdKeywords.gapsDetected.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Strong Matches */}
        <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                ✅ Strong Matches ({uniqueStrongMatches.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {uniqueStrongMatches.map((kw) => (
                <Chip key={kw} label={kw} color="success" variant="outlined" size="small" />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Keywords Added by Claude */}
        <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                💡 Keywords Added by Claude ({uniqueKeywordsAdded.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {uniqueKeywordsAdded.map((kw) => (
                <Chip key={kw} label={kw} color="primary" variant="outlined" size="small" />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Dealbreakers */}
        <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                ❌ Dealbreakers / Missing ({uniqueDealbreakers.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {uniqueDealbreakers.map((db) => {
                const resolved = isDealbreakerResolved(db.id);
                return (
                  <FormControlLabel key={db.id}
                    control={<Checkbox checked={resolved} disabled color="error" />}
                    label={
                      <Typography variant="body2" sx={{
                        textDecoration: resolved ? 'line-through' : 'none',
                        color: resolved ? 'text.secondary' : 'error.main',
                        opacity: resolved ? 0.6 : 1,
                        fontWeight: resolved ? 400 : 600,
                      }}>
                        {db.text}{resolved && ' (Covered by recommendation)'}
                      </Typography>
                    }
                  />
                );
              })}
              {uniqueDealbreakers.length === 0 && (
                <Typography variant="body2" sx={{ color: 'success.main' }}>No dealbreakers — excellent match!</Typography>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Recommendations */}
        <Accordion defaultExpanded variant="outlined" sx={{ borderColor: 'divider', backgroundColor: '#0f1117', mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  📋 Actionable Recommendations ({allRecommendations.length})
                </Typography>
              </Box>
              <IconButton
                id="refresh-recommendations-btn"
                size="small"
                disabled={isRefreshing || isLoading}
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsRefreshing(true);
                  await handleRefreshRecommendations(anthropicKey || undefined);
                  setIsRefreshing(false);
                }}
                title="Re-analyse resume against JD and surface any new gaps"
                sx={{
                  color: 'warning.main',
                  opacity: isRefreshing ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                  '&:hover': { backgroundColor: 'rgba(237,108,2,0.1)' },
                }}
              >
                {isRefreshing
                  ? <CircularProgress size={16} color="warning" />
                  : <AutorenewIcon fontSize="small" sx={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />}
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {allRecommendations.map((rec) => {
                const applied = appliedRecs.has(rec.id);
                const checked = selectedRecs.includes(rec.id);
                const isCustom = rec.id.startsWith('custom-');
                return (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    checked={checked}
                    applied={applied}
                    isCustom={isCustom}
                    onToggle={() => handleRecToggle(rec.id)}
                  />
                );
              })}

              {/* Add Custom Recommendation UI */}
              <Box sx={{ mt: 1, p: 2, borderRadius: 2, border: '1px dashed', borderColor: 'divider', backgroundColor: '#161920' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.8rem', color: 'text.primary' }}>
                  ➕ Add Custom Refinement Instruction
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="e.g., Add Python to Core Competencies, highlight my AWS cert..."
                    value={customRecText}
                    onChange={(e) => setCustomRecText(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#0f1117' } }}
                  />
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    onClick={() => {
                      if (!customRecText.trim()) return;
                      const newRec: Recommendation = {
                        id: `custom-${Date.now()}`,
                        claim: customRecText.trim(),
                        targetSection: 'User Custom Instruction',
                        evidenceRequired: 'User supplied',
                        evidenceFound: 'User supplied',
                        riskLevel: 'medium',
                        resolvesDealbreakers: [],
                      };
                      setCustomRecommendations((prev) => [...prev, newRec]);
                      setSelectedRecs((prev) => [...prev, newRec.id]);
                      setCustomRecText('');
                    }}
                    sx={{ fontWeight: 600, px: 2 }}
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        <Button variant="contained" color="warning" fullWidth
          onClick={async () => {
            const selectedObjects = selectedRecs.map(id => {
              return allRecommendations.find(r => r.id === id);
            }).filter((r): r is Recommendation => !!r);
            const success = await handleRefine(selectedObjects, anthropicKey);
            if (success) {
              setAppliedRecs(prev => {
                const next = new Set<string>();
                prev.forEach(id => next.add(id));
                selectedRecs.forEach(id => next.add(id));
                return next;
              });
              setSelectedRecs([]);
            }
          }}
          disabled={selectedRecs.length === 0 || isLoading || (!hasServerKey && !anthropicKey)}
          sx={{ py: 1.2, fontWeight: 700 }}>
          {isLoading ? <CircularProgress size={20} /> : `Apply Selected Suggestions (${selectedRecs.length})`}
        </Button>

        {output.gapAnalysis.summaryChanges && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(108,99,255,0.06)', border: '1px solid', borderColor: 'rgba(108,99,255,0.2)', borderRadius: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              📝 Summary changes: {output.gapAnalysis.summaryChanges}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
