/**
 * __tests__/schema.test.ts
 * Zod schema validation tests for ResumeBuilderOutputSchema and RefineOutputSchema.
 *
 * Run: npx jest __tests__/schema.test.ts
 */

import { ResumeBuilderOutputSchema, RefineOutputSchema } from '../lib/llm/schema';

// ── Helpers ───────────────────────────────────────────────────────────────────

const minimalGapAnalysis = {
  matchScore: 75,
  strongMatches: ['Python', 'AWS'],
  gaps: ['Kubernetes'],
  dealbreakers: [],
  recommendations: [],
  keywordsAdded: ['Kubernetes'],
  missingKeywords: [],
  summaryChanges: 'Added Kubernetes.',
};

const minimalResume = {
  name: 'Jane Doe',
  contact: {
    email: 'jane@example.com',
    phone: null,
    linkedin: null,
    github: null,
    location: null,
  },
  summary: 'Software engineer.',
  skills: [],
  experience: [],
  projects: [],
  education: [],
};

// ── ResumeBuilderOutputSchema ─────────────────────────────────────────────────

describe('ResumeBuilderOutputSchema', () => {
  it('passes with a minimal valid payload', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: minimalGapAnalysis,
      resume: minimalResume,
    });
    expect(result.success).toBe(true);
  });

  it('passes with an optional coverLetter', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: minimalGapAnalysis,
      resume: minimalResume,
      coverLetter: { subject: 'Re: Engineer role', body: 'Dear Hiring Manager,' },
    });
    expect(result.success).toBe(true);
  });

  it('passes without coverLetter (it is optional)', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: minimalGapAnalysis,
      resume: minimalResume,
    });
    expect(result.success).toBe(true);
  });

  it('fails when gapAnalysis is missing', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      resume: minimalResume,
    });
    expect(result.success).toBe(false);
  });

  it('fails when matchScore is out of range (> 100)', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: { ...minimalGapAnalysis, matchScore: 105 },
      resume: minimalResume,
    });
    expect(result.success).toBe(false);
  });

  it('fails when matchScore is negative', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: { ...minimalGapAnalysis, matchScore: -1 },
      resume: minimalResume,
    });
    expect(result.success).toBe(false);
  });

  it('fails when a recommendation has an invalid riskLevel', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: {
        ...minimalGapAnalysis,
        recommendations: [{
          id: 'r1',
          claim: 'Add Kubernetes',
          targetSection: 'Skills',
          evidenceRequired: 'k8s xp',
          evidenceFound: 'Docker mentioned',
          riskLevel: 'critical', // not in enum
          resolvesDealbreakers: [],
        }],
      },
      resume: minimalResume,
    });
    expect(result.success).toBe(false);
  });

  it('defaults resolvesDealbreakers to [] when omitted', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: {
        ...minimalGapAnalysis,
        recommendations: [{
          id: 'r1',
          claim: 'Add Kubernetes',
          targetSection: 'Skills',
          evidenceRequired: 'k8s xp',
          evidenceFound: 'Docker mentioned',
          riskLevel: 'medium',
          // resolvesDealbreakers intentionally omitted
        }],
      },
      resume: minimalResume,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gapAnalysis.recommendations[0].resolvesDealbreakers).toEqual([]);
    }
  });

  it('passes extractedCompanyName through when present', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: { ...minimalGapAnalysis, extractedCompanyName: 'Acme Corp' },
      resume: minimalResume,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gapAnalysis.extractedCompanyName).toBe('Acme Corp');
    }
  });

  it('passes when extractedCompanyName is null', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: { ...minimalGapAnalysis, extractedCompanyName: null },
      resume: minimalResume,
    });
    expect(result.success).toBe(true);
  });

  it('clamps summary, skills, and experience scores when they exceed maximum limits', () => {
    const result = ResumeBuilderOutputSchema.safeParse({
      gapAnalysis: {
        ...minimalGapAnalysis,
        scoreBreakdown: {
          summary: 35, // max 25
          skills: 50, // max 30
          experience: 45, // max 30
          dealbreakersDeducted: 10,
        },
      },
      resume: minimalResume,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const breakdown = result.data.gapAnalysis.scoreBreakdown;
      expect(breakdown).toBeDefined();
      expect(breakdown?.summary).toBe(25);
      expect(breakdown?.skills).toBe(30);
      expect(breakdown?.experience).toBe(30);
      expect(breakdown?.dealbreakersDeducted).toBe(10);
    }
  });
});

// ── RefineOutputSchema ────────────────────────────────────────────────────────

describe('RefineOutputSchema', () => {
  it('passes with a minimal valid refine payload', () => {
    const result = RefineOutputSchema.safeParse({
      resume: minimalResume,
      updatedMatchScore: 82,
    });
    expect(result.success).toBe(true);
  });

  it('passes with an optional updated cover letter', () => {
    const result = RefineOutputSchema.safeParse({
      resume: minimalResume,
      coverLetter: { subject: 'Updated', body: 'Updated body.' },
      updatedMatchScore: 90,
    });
    expect(result.success).toBe(true);
  });

  it('fails when updatedMatchScore is missing', () => {
    const result = RefineOutputSchema.safeParse({
      resume: minimalResume,
    });
    expect(result.success).toBe(false);
  });

  it('fails when updatedMatchScore is out of range', () => {
    const result = RefineOutputSchema.safeParse({
      resume: minimalResume,
      updatedMatchScore: 101,
    });
    expect(result.success).toBe(false);
  });

  it('fails when resume is missing', () => {
    const result = RefineOutputSchema.safeParse({
      updatedMatchScore: 80,
    });
    expect(result.success).toBe(false);
  });
});
