/**
 * schema.ts — Zod runtime validation for LLM output.
 */

import { z } from 'zod';

// ── Primitives ──────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  name:        z.string(),
  description: z.string().nullable(),
  bullets:     z.array(z.string()),
  link:        z.string().nullable(),
  tech:        z.array(z.string()),
});

const ExperienceSchema = z.object({
  title:     z.string().min(1),
  company:   z.string().min(1),
  location:  z.string().nullable(),
  startDate: z.string(),
  endDate:   z.string(),
  bullets:   z.array(z.string()),
  tech:      z.array(z.string()),
  projects:  z.array(ProjectSchema),
}).refine(
  (data) => {
    // If experience has projects, standard bullets must be empty to avoid redundancy
    if (data.projects && data.projects.length > 0) {
      return data.bullets.length === 0;
    }
    return true;
  },
  {
    message: 'Experience entries with projects should not duplicate bullets.',
    path: ['bullets'],
  }
);

const EducationSchema = z.object({
  degree:      z.string().min(1),
  institution: z.string(),
  year:        z.string().nullable(),
});

const SkillGroupSchema = z.object({
  category: z.string(),
  items:    z.array(z.string()),
});

const DealbreakerSchema = z.object({
  id:   z.string(),
  text: z.string(),
});

const RecommendationSchema = z.object({
  id:                   z.string(),
  claim:                z.string(),
  targetSection:        z.string(),
  evidenceRequired:     z.string(),
  evidenceFound:        z.string(),
  riskLevel:            z.enum(['low', 'medium', 'high']),
  // LLMs sometimes omit this when no dealbreakers are resolved — default to []
  resolvesDealbreakers: z.array(z.string()).default([]),
});

const MissingKeywordSchema = z.object({
  id:               z.string(),
  keyword:          z.string(),
  suggestedSection: z.string(),
  suggestedBullet:  z.string(),
});

// ── Shared Resume Schema ─────────────────────────────────────────────────────

const ResumeSchema = z.object({
  name:    z.string().optional(),
  contact: z.object({
    email:    z.string(),
    phone:    z.string().nullable(),
    linkedin: z.string().nullable(),
    github:   z.string().nullable(),
    location: z.string().nullable(),
  }).optional(),
  summary:         z.string().optional(),
  skills:          z.array(SkillGroupSchema).optional(),
  experience:      z.array(ExperienceSchema).optional(),
  projects:        z.array(ProjectSchema).optional(),
  education:       z.array(EducationSchema).optional(),
  certifications:  z.array(z.string()).optional(),
  publications:    z.array(z.string()).optional(),
  awards:          z.array(z.string()).optional(),
  languages:       z.array(z.string()).optional(),
});

const CoverLetterSchema = z.object({
  subject: z.string(),
  body:    z.string(),
});

const ScoreBreakdownSchema = z.object({
  summary: z.preprocess(
    (val) => typeof val === 'number' ? Math.min(Math.max(val, 0), 25) : val,
    z.number().int()
  ),
  skills: z.preprocess(
    (val) => typeof val === 'number' ? Math.min(Math.max(val, 0), 30) : val,
    z.number().int()
  ),
  experience: z.preprocess(
    (val) => typeof val === 'number' ? Math.min(Math.max(val, 0), 30) : val,
    z.number().int()
  ),
  dealbreakersDeducted: z.number().int().min(0),
});

export const JDExtractionResultSchema = z.object({
  seniority: z.string(),
  companyName: z.string().nullable(),
  mustHaveSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  gapsDetected: z.array(z.string()),
});

// ── Top-level output ─────────────────────────────────────────────────────────

export const ResumeBuilderOutputSchema = z.object({
  gapAnalysis: z.object({
    matchScore:      z.number().int().min(0).max(100),
    scoreBreakdown:  ScoreBreakdownSchema.optional(),
    strongMatches:   z.array(z.string()),
    gaps:            z.array(z.string()),
    dealbreakers:    z.array(DealbreakerSchema),
    recommendations: z.array(RecommendationSchema),
    keywordsAdded:   z.array(z.string()),
    missingKeywords: z.array(MissingKeywordSchema),
    summaryChanges:  z.string(),
    extractedCompanyName: z.string().nullable().optional(),
    metrics:         z.array(z.string()).optional(),
  }),
  resume: z.lazy(() => ResumeSchema),
  coverLetter: CoverLetterSchema.optional(),
});

export const RefineOutputSchema = z.object({
  resume: z.lazy(() => ResumeSchema),
  coverLetter: CoverLetterSchema.optional(),
  updatedMatchScore: z.number().int().min(0).max(100),
  metrics:           z.array(z.string()).optional(),
});

export type ValidatedResumeBuilderOutput = z.infer<typeof ResumeBuilderOutputSchema>;
export type ValidatedRefineOutput = z.infer<typeof RefineOutputSchema>;
