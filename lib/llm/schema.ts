/**
 * schema.ts — Zod runtime validation for LLM output.
 *
 * Called via `safeParse()` in every provider adapter immediately after
 * JSON.parse. Prevents malformed LLM responses from reaching React state
 * or DOCX generation unchecked.
 *
 * The schema mirrors the TypeScript types in types/index.ts. If you add
 * a field to the types, add it here too — the build will not enforce this
 * automatically because providers cast with `as` before this file existed.
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

const MissingKeywordSchema = z.object({
  keyword:          z.string(),
  suggestedSection: z.string(),
  suggestedBullet:  z.string(),
});

// ── Top-level output ─────────────────────────────────────────────────────────

export const ResumeBuilderOutputSchema = z.object({
  gapAnalysis: z.object({
    matchScore:      z.number().int().min(0).max(100),
    strongMatches:   z.array(z.string()),
    gaps:            z.array(z.string()),
    dealbreakers:    z.array(z.string()),
    recommendations: z.array(z.string()),
    keywordsAdded:   z.array(z.string()),
    missingKeywords: z.array(MissingKeywordSchema),
    summaryChanges:  z.string(),
  }),

  resume: z.object({
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
    education:       z.array(EducationSchema).optional(),
    certifications:  z.array(z.string()).optional(),
    publications:    z.array(z.string()).optional(),
    awards:          z.array(z.string()).optional(),
    languages:       z.array(z.string()).optional(),
  }),

  coverLetter: z.object({
    subject: z.string(),
    body:    z.string(),
  }).optional(),
});

export type ValidatedResumeBuilderOutput = z.infer<typeof ResumeBuilderOutputSchema>;
