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
 *
 * Skills coercion
 * ───────────────
 * Different models return the skills field in three different shapes:
 *   A) [{ category: "Languages", items: ["Python"] }]  ← our canonical form
 *   B) ["Python", "React", "Node.js"]                  ← flat string array
 *   C) { "Languages": ["Python"], "Frameworks": [...] } ← plain object map
 *
 * The coerceSkills transform accepts all three and normalises to shape A so
 * the rest of the app never needs to handle the variations.
 */

import { z } from 'zod';

// ── Primitives ──────────────────────────────────────────────────────────────

const ProjectSchema = z.object({
  name:        z.string(),
  description: z.string().default(''),
  bullets:     z.array(z.string()).default([]),
  link:        z.string().nullable().default(null),
  tech:        z.array(z.string()).default([]),
});

const ExperienceSchema = z.object({
  title:     z.string(),
  company:   z.string(),
  location:  z.string().nullable().default(null),
  startDate: z.string().default(''),
  endDate:   z.string().default(''),
  bullets:   z.array(z.string()).default([]),
  tech:      z.array(z.string()).default([]),
  projects:  z.array(ProjectSchema).default([]),
});

const EducationSchema = z.object({
  degree:      z.string(),
  institution: z.string(),
  year:        z.string().nullable(),
});

export const SkillGroupSchema = z.object({
  category: z.string(),
  items:    z.array(z.string()),
});
export type SkillGroup = z.infer<typeof SkillGroupSchema>;

const MissingKeywordSchema = z.object({
  keyword:          z.string(),
  suggestedSection: z.string(),
  suggestedBullet:  z.string(),
});

// ── Skills coercion ──────────────────────────────────────────────────────────
// Accepts shape A, B, or C and always emits SkillGroup[].

function coerceSkills(raw: unknown): SkillGroup[] {
  if (!raw) return [];

  // Shape A — already correct: [{category, items}]
  if (Array.isArray(raw)) {
    // Could be shape B (string[]) or shape A (SkillGroup[])
    if (raw.length === 0) return [];

    if (typeof raw[0] === 'string') {
      // Shape B — flat string list → single "Skills" group
      return [{ category: 'Skills', items: raw as string[] }];
    }

    // Assume shape A — validate each element, skip bad ones
    return (raw as unknown[]).flatMap((item) => {
      const r = SkillGroupSchema.safeParse(item);
      return r.success ? [r.data] : [];
    });
  }

  // Shape C — plain object map: { "Languages": ["Python"], ... }
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => Array.isArray(v))
      .map(([category, items]) => ({
        category,
        items: (items as unknown[]).filter((i): i is string => typeof i === 'string'),
      }))
      .filter((g) => g.items.length > 0);
  }

  return [];
}

// Zod schema that accepts any shape and coerces to SkillGroup[]
const FlexibleSkillsSchema = z
  .any()
  .transform((raw) => coerceSkills(raw));

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
    extractedCompanyName: z.string().nullable().optional(),
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
    skills:          FlexibleSkillsSchema.optional(),
    experience:      z.array(ExperienceSchema).optional(),
    projects:        z.array(ProjectSchema).optional(),
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
