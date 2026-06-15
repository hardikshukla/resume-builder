import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PrintIcon from '@mui/icons-material/Print';
import { ResumeBuilderOutput } from '@/types';
import { renderDiffText } from '@/lib/utils/highlight';
import { EditableField } from './EditableField';

const A4_STYLES = {
  backgroundColor: '#ffffff',
  color: '#000000',
  p: 6,
  fontFamily: '"Times New Roman", Times, serif',
  fontSize: '11pt',
  lineHeight: 1.5,
  boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
  border: '1px solid #d3d3d3',
  minHeight: '11in',
  width: '100%',
  maxWidth: '8.5in',
  mx: 'auto',
} as const;

const SECTION_HEADER_SX = {
  fontFamily: '"Times New Roman"',
  fontSize: '11pt',
  borderBottom: '1px solid #000',
  pb: 0.2,
  mb: 0.8,
  textTransform: 'uppercase' as const,
  fontWeight: 700,
};

const BODY_TEXT_SX = {
  fontFamily: '"Times New Roman"',
  fontSize: '11pt',
};

interface ResumePreviewProps {
  output: ResumeBuilderOutput;
  originalOutput: ResumeBuilderOutput | null;
  showHighlights: boolean;
  setShowHighlights: (checked: boolean) => void;
  boldingKeywords: string[];
  dropboxToken: string | null;
  dropboxStatus: { type: 'success' | 'error'; message: string } | null;
  setDropboxStatus: (status: { type: 'success' | 'error'; message: string } | null) => void;
  handleDownload: (type: 'resume' | 'coverLetter') => void;
  handleSaveToDropbox: (type: 'resume' | 'coverLetter') => void;
  handleManualEdit: (path: string, value: string) => void;
  handlePrint: () => void;
  manualEdits: { path: string; originalValue: string; editedValue: string }[];
  orphanedEdits: { path: string; originalValue: string; editedValue: string }[];
  clearOrphanedEdits: (prefix?: 'resume' | 'coverLetter') => void;
}

export default function ResumePreview({
  output,
  originalOutput,
  showHighlights,
  setShowHighlights,
  boldingKeywords,
  dropboxToken,
  dropboxStatus,
  setDropboxStatus,
  handleDownload,
  handleSaveToDropbox,
  handleManualEdit,
  handlePrint,
  manualEdits,
  orphanedEdits,
  clearOrphanedEdits,
}: ResumePreviewProps) {
  const resumeOrphans = useMemo(() => {
    return orphanedEdits.filter((e) => e.path.startsWith('resume'));
  }, [orphanedEdits]);

  const renderDiff = (original: string | undefined, current: string, applyBolding = true) => {
    return renderDiffText(original, current, showHighlights, boldingKeywords, applyBolding);
  };

  return (
    <Box id="tabpanel-resume" role="tabpanel" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <FormControlLabel
          control={<Switch checked={showHighlights} onChange={(e) => setShowHighlights(e.target.checked)} color="success" />}
          label="Show Highlights"
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button startIcon={<DownloadIcon />} variant="outlined" size="small" onClick={() => handleDownload('resume')}>Download DOCX</Button>
          {dropboxToken && (
            <Button startIcon={<CloudUploadIcon />} variant="outlined" color="primary" size="small" onClick={() => handleSaveToDropbox('resume')}>Save to Dropbox</Button>
          )}
          <Button startIcon={<PrintIcon />} variant="contained" color="secondary" size="small" onClick={handlePrint}>Print / PDF</Button>
        </Box>
      </Box>

      {dropboxStatus && (
        <Alert severity={dropboxStatus.type} onClose={() => setDropboxStatus(null)}>{dropboxStatus.message}</Alert>
      )}

      {resumeOrphans && resumeOrphans.length > 0 && (
        <Alert severity="warning" onClose={() => clearOrphanedEdits('resume')} sx={{ mb: 2 }}>
          <strong>⚠️ Unapplied Edits:</strong> The following manual edit(s) could not be automatically merged because the content was significantly rewritten during refinement:
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {resumeOrphans.map((edit, idx) => (
              <Box component="li" key={idx} sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                At <code>{edit.path}</code>: <em>&ldquo;{edit.editedValue}&rdquo;</em>
              </Box>
            ))}
          </Box>
        </Alert>
      )}

      {output.hallucinationReport && !output.hallucinationReport.passed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>⚠️ Unverified Claims Detected:</strong> {output.hallucinationReport.flaggedClaims.length} claim(s) could not be verified against your original resume background. Please review:
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {output.hallucinationReport.flaggedClaims.map((claim, idx) => (
              <Box component="li" key={idx} sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                {claim.reason}
              </Box>
            ))}
          </Box>
        </Alert>
      )}

      {/* A4 Preview */}
      <Box id="resume-print-area" sx={A4_STYLES}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, fontSize: '14pt', textTransform: 'uppercase' }}>
            {output.resume.name || 'Candidate Name'}
          </Typography>
          <Typography sx={{ ...BODY_TEXT_SX, mt: 0.5 }}>
            {[output.resume.contact?.email, output.resume.contact?.phone, output.resume.contact?.linkedin, output.resume.contact?.github, output.resume.contact?.location].filter(Boolean).join('  |  ')}
          </Typography>
          <Divider sx={{ mt: 1, borderColor: '#000', borderBottomWidth: 1.5 }} />
        </Box>

        {/* Summary */}
        {output.resume.summary && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Summary</Typography>
            <Typography sx={{ ...BODY_TEXT_SX, textAlign: 'justify' }}>
              <EditableField
                path="resume.summary"
                value={output.resume.summary}
                multiline
                onSave={handleManualEdit}
                isEdited={manualEdits.some(e => e.path === 'resume.summary')}
              >
                {renderDiff(originalOutput?.resume.summary, output.resume.summary)}
              </EditableField>
            </Typography>
          </Box>
        )}

        {/* Skills */}
        {output.resume.skills && output.resume.skills.length > 0 && (
          <Box className="skills-grid" sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Core Competencies</Typography>
            {output.resume.skills.map((sg, idx) => (
              <Box key={idx} className="skills-row" sx={{ display: 'flex', gap: 1, mb: 0.4 }}>
                <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700, width: 154, minWidth: 154, flexShrink: 0 }}>
                  {sg.category}:
                </Typography>
                <Typography sx={BODY_TEXT_SX}>
                  <EditableField
                    path={`resume.skills[${idx}].items`}
                    value={sg.items.join(', ')}
                    onSave={handleManualEdit}
                    isEdited={manualEdits.some(e => e.path === `resume.skills[${idx}].items`)}
                  >
                    {renderDiff(originalOutput?.resume.skills?.[idx]?.items.join(', '), sg.items.join(', '))}
                  </EditableField>
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Experience */}
        {output.resume.experience && output.resume.experience.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Experience</Typography>
            {output.resume.experience.map((exp, expIdx) => {
              const origExp = originalOutput?.resume.experience?.[expIdx];
              return (
                <Box key={expIdx} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>
                      {exp.title} | {exp.company}
                    </Typography>
                    <Typography sx={BODY_TEXT_SX}>
                      {exp.startDate} – {exp.endDate}
                    </Typography>
                  </Box>
                  {exp.location && (
                    <Typography sx={{ ...BODY_TEXT_SX, fontStyle: 'italic', mb: 0.5 }}>{exp.location}</Typography>
                  )}
                  {(!exp.projects || exp.projects.length === 0) && (
                    <>
                      <Box sx={{ mt: 0.3 }}>
                        {exp.bullets.map((b, bi) => (
                          <Box key={bi} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.3, pl: 2 }}>
                            <Box component="span" sx={{ ...BODY_TEXT_SX, flexShrink: 0, mr: 1, lineHeight: 1.5 }}>•</Box>
                            <Typography sx={{ ...BODY_TEXT_SX, flex: 1 }}>
                              <EditableField
                                path={`resume.experience[${expIdx}].bullets[${bi}]`}
                                value={b}
                                multiline
                                onSave={handleManualEdit}
                                isEdited={manualEdits.some(e => e.path === `resume.experience[${expIdx}].bullets[${bi}]`)}
                              >
                                {renderDiff(origExp?.bullets?.[bi], b, false)}
                              </EditableField>
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                      {exp.tech && exp.tech.length > 0 && (
                        <Typography sx={{ ...BODY_TEXT_SX, fontSize: '10pt', fontStyle: 'italic', mt: 0.4 }}>
                          Stack: {exp.tech.join(', ')}
                        </Typography>
                      )}
                    </>
                  )}
                  {exp.projects && exp.projects.length > 0 && (
                    <Box sx={{ mt: 0.5 }}>
                      {exp.projects.map((proj, pi) => {
                        const origProj = origExp?.projects?.[pi];
                        return (
                          <Box key={pi} sx={{ pl: 2, mb: 1 }}>
                            <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>{proj.name}</Typography>
                            {proj.description && (
                              <Typography sx={{ ...BODY_TEXT_SX, fontStyle: 'italic' }}>
                                <EditableField
                                  path={`resume.experience[${expIdx}].projects[${pi}].description`}
                                  value={proj.description}
                                  multiline
                                  onSave={handleManualEdit}
                                  isEdited={manualEdits.some(e => e.path === `resume.experience[${expIdx}].projects[${pi}].description`)}
                                >
                                  {proj.description}
                                </EditableField>
                              </Typography>
                            )}
                            <Box sx={{ mt: 0.3, pl: 1 }}>
                              {proj.bullets.map((b, bi) => (
                                <Box key={bi} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.2 }}>
                                  <Box component="span" sx={{ ...BODY_TEXT_SX, flexShrink: 0, mr: 1, lineHeight: 1.5 }}>•</Box>
                                  <Typography sx={{ ...BODY_TEXT_SX, flex: 1 }}>
                                    <EditableField
                                      path={`resume.experience[${expIdx}].projects[${pi}].bullets[${bi}]`}
                                      value={b}
                                      multiline
                                      onSave={handleManualEdit}
                                      isEdited={manualEdits.some(e => e.path === `resume.experience[${expIdx}].projects[${pi}].bullets[${bi}]`)}
                                    >
                                      {renderDiff(origProj?.bullets?.[bi], b, false)}
                                    </EditableField>
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                            {proj.tech && proj.tech.length > 0 && (
                              <Typography sx={{ ...BODY_TEXT_SX, fontSize: '10pt', fontStyle: 'italic', mt: 0.3 }}>
                                Stack: {proj.tech.join(', ')}{proj.link ? ` | ${proj.link}` : ''}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Projects */}
        {output.resume.projects && output.resume.projects.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Projects</Typography>
            {output.resume.projects.map((proj, idx) => {
              const origProj = originalOutput?.resume.projects?.[idx];
              return (
                <Box key={idx} sx={{ mb: 1.5 }}>
                  <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>
                    {proj.name}
                  </Typography>
                  {proj.description && (
                    <Typography sx={{ ...BODY_TEXT_SX, fontStyle: 'italic' }}>
                      <EditableField
                        path={`resume.projects[${idx}].description`}
                        value={proj.description}
                        multiline
                        onSave={handleManualEdit}
                        isEdited={manualEdits.some(e => e.path === `resume.projects[${idx}].description`)}
                      >
                        {renderDiff(origProj?.description ?? undefined, proj.description, false)}
                      </EditableField>
                    </Typography>
                  )}
                  {proj.bullets && proj.bullets.length > 0 && (
                    <Box sx={{ mt: 0.3 }}>
                      {proj.bullets.map((b, bi) => (
                        <Box key={bi} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.2, pl: 2 }}>
                          <Box component="span" sx={{ ...BODY_TEXT_SX, flexShrink: 0, mr: 1, lineHeight: 1.5 }}>•</Box>
                          <Typography sx={{ ...BODY_TEXT_SX, flex: 1 }}>
                            <EditableField
                              path={`resume.projects[${idx}].bullets[${bi}]`}
                              value={b}
                              multiline
                              onSave={handleManualEdit}
                              isEdited={manualEdits.some(e => e.path === `resume.projects[${idx}].bullets[${bi}]`)}
                            >
                              {renderDiff(origProj?.bullets?.[bi], b, false)}
                            </EditableField>
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {proj.tech && proj.tech.length > 0 && (
                    <Typography sx={{ ...BODY_TEXT_SX, fontSize: '10pt', fontStyle: 'italic', mt: 0.3 }}>
                      Stack: {proj.tech.join(', ')}{proj.link ? ` | ${proj.link}` : ''}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}

        {/* Education */}
        {output.resume.education && output.resume.education.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Education</Typography>
            {output.resume.education.map((edu, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ ...BODY_TEXT_SX, fontWeight: 700 }}>
                  {edu.degree} — {edu.institution}
                </Typography>
                {edu.year && (
                  <Typography sx={BODY_TEXT_SX}>{edu.year}</Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Certifications */}
        {output.resume.certifications && output.resume.certifications.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Certifications</Typography>
            <Box sx={{ mt: 0.3 }}>
              {output.resume.certifications.map((cert, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.2, pl: 2 }}>
                  <Box component="span" sx={{ ...BODY_TEXT_SX, flexShrink: 0, mr: 1, lineHeight: 1.5 }}>•</Box>
                  <Typography sx={{ ...BODY_TEXT_SX, flex: 1 }}>{cert}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Publications */}
        {output.resume.publications && output.resume.publications.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Publications</Typography>
            <Box sx={{ mt: 0.3 }}>
              {output.resume.publications.map((pub, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.2, pl: 2 }}>
                  <Box component="span" sx={{ ...BODY_TEXT_SX, flexShrink: 0, mr: 1, lineHeight: 1.5 }}>•</Box>
                  <Typography sx={{ ...BODY_TEXT_SX, flex: 1 }}>{pub}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Awards */}
        {output.resume.awards && output.resume.awards.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Awards</Typography>
            <Box sx={{ mt: 0.3 }}>
              {output.resume.awards.map((aw, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.2, pl: 2 }}>
                  <Box component="span" sx={{ ...BODY_TEXT_SX, flexShrink: 0, mr: 1, lineHeight: 1.5 }}>•</Box>
                  <Typography sx={{ ...BODY_TEXT_SX, flex: 1 }}>{aw}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Languages */}
        {output.resume.languages && output.resume.languages.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={SECTION_HEADER_SX}>Languages</Typography>
            <Typography sx={BODY_TEXT_SX}>
              {output.resume.languages.join(', ')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
