/**
 * schema.ts — Zod runtime validation for LLM output.
 */

import { z } from 'zod';

// ── Primitives ──────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  name:        z.string(),
  description: z.string(),
  bullets:     z.array(z.string()),
  link:        z.string().nullable(),
  tech:        z.array(z.string()),
});

const ExperienceSchema = z.object({
  title:     z.string(),
  company:   z.string(),
  location:  z.string().nullable(),
  startDate: z.string(),
  endDate:   z.string(),
  bullets:   z.array(z.string()),
  tech:      z.array(z.string()),
  projects:  z.array(ProjectSchema),
});

const EducationSchema = z.object({
  degree:      z.string(),
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
  id:   z.string(),
  text: z.string(),
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

// ── Top-level output ─────────────────────────────────────────────────────────

export const ResumeBuilderOutputSchema = z.object({
  gapAnalysis: z.object({
    matchScore:      z.number().int().min(0).max(100),
    strongMatches:   z.array(z.string()),
    gaps:            z.array(z.string()),
    dealbreakers:    z.array(DealbreakerSchema),
    recommendations: z.array(RecommendationSchema),
    keywordsAdded:   z.array(z.string()),
    missingKeywords: z.array(MissingKeywordSchema),
    summaryChanges:  z.string(),
    extractedCompanyName: z.string().nullable().optional(),
  }),
  resume: z.lazy(() => ResumeSchema),
  coverLetter: CoverLetterSchema.optional(),
});

export const RefineOutputSchema = z.object({
  resume: z.lazy(() => ResumeSchema),
  coverLetter: CoverLetterSchema.optional(),
  updatedMatchScore: z.number().int().min(0).max(100),
});

export type ValidatedResumeBuilderOutput = z.infer<typeof ResumeBuilderOutputSchema>;
export type ValidatedRefineOutput = z.infer<typeof RefineOutputSchema>;
