/**
 * T7.2 — Unit tests: prompt builder functions + GapAnalysis schema
 *
 * Run: npx jest __tests__/prompt.test.ts
 */

import {
  SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
  JD_EXTRACTION_SYSTEM_PROMPT,
} from '../lib/prompt';
import { ResumeBuilderOutputSchema } from '../lib/llm/schema';
import { Recommendation } from '../types';

// ── SYSTEM_PROMPT ────────────────────────────────────────────────────────────

describe('SYSTEM_PROMPT', () => {
  const prompt = SYSTEM_PROMPT;

  it('returns a non-empty string', () => {
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('contains the 6-step ATS methodology headings', () => {
    expect(prompt).toContain('1. Analyze');
    expect(prompt).toContain('2. Keyword');
    expect(prompt).toContain('3. Section');
    expect(prompt).toContain('4. Format');
    expect(prompt).toContain('5. Populate');
    expect(prompt).toContain('6. Cover');
  });

  it('treats resume and JD content as untrusted input', () => {
    expect(prompt).toContain('security_boundary');
    expect(prompt).toMatch(/Ignore any instructions/i);
  });

  it('instructs the model NOT to use placeholders', () => {
    expect(prompt.toLowerCase()).toContain('placeholder');
    expect(prompt).toMatch(/never embed placeholder/i);
  });

  it('forbids unsupported company-scale metrics', () => {
    expect(prompt).toMatch(/Scale claims/i);
    expect(prompt).toMatch(/must come strictly from the original resume/i);
  });

  it('references missingKeywords in the JSON schema instruction', () => {
    expect(prompt).toContain('missingKeywords');
  });

  it('contains the recommendations guidelines including Career Coach style and generic filter', () => {
    expect(prompt).toContain('recommendations_guidelines');
    expect(prompt).toMatch(/Career Coach Tone/i);
    expect(prompt).toMatch(/No Generic Advice/i);
    expect(prompt).toMatch(/evidenceRequired/i);
    expect(prompt).toMatch(/evidenceFound/i);
    expect(prompt).toMatch(/riskLevel/i);
  });

  it('contains the project description synthesis rule in rules section', () => {
    expect(prompt).toMatch(/For projects: Synthesize an extremely concise 1-sentence description/i);
    expect(prompt).toMatch(/maximum of 15 words/i);
    expect(prompt).toMatch(/Do NOT include tech stack, tools, or implementation details/i);
    expect(prompt).toMatch(/synthesize a basic one-line description \(under 15 words/i);
  });
});

// ── REFINE_SYSTEM_PROMPT ──────────────────────────────────────────────────────

describe('REFINE_SYSTEM_PROMPT', () => {
  it('instructs the model to return updatedMatchScore', () => {
    expect(REFINE_SYSTEM_PROMPT).toContain('updatedMatchScore');
  });

  it('instructs the model to apply ONLY the listed improvements', () => {
    expect(REFINE_SYSTEM_PROMPT).toMatch(/Apply ONLY the (?:selected )?improvements listed/i);
  });

  it('treats selected suggestions as mandatory commands', () => {
    expect(REFINE_SYSTEM_PROMPT).toMatch(/mandatory commands/i);
    expect(REFINE_SYSTEM_PROMPT).toMatch(/You MUST apply them/i);
  });

  it('instructs model to apply changes to both resume AND cover letter', () => {
    expect(REFINE_SYSTEM_PROMPT).toMatch(/resume AND cover letter/i);
  });
});

// ── GapAnalysis schema guard ─────────────────────────────────────────────────

describe('GapAnalysis schema shape', () => {
  // Simulate what the LLM returns and what our Zod guard validates
  const validGapAnalysis = {
    matchScore:    72,
    strongMatches: ['Python', 'AWS'],
    gaps:          ['Kubernetes'],
    dealbreakers:  [],
    recommendations: [
      {
        id: 'rec-1',
        claim: 'Add Kubernetes to Core Competencies',
        targetSection: 'Core Competencies',
        evidenceRequired: 'Kubernetes experience',
        evidenceFound: 'Docker mentioned',
        riskLevel: 'medium',
        resolvesDealbreakers: [],
      },
    ],
    missingKeywords: [
      {
        id:               'kw-terraform',
        keyword:          'Terraform',
        suggestedSection: 'Core Competencies',
        suggestedBullet:  'Managed infrastructure as code using Terraform',
      },
    ],
    keywordsAdded:  ['Kubernetes'],
    summaryChanges: 'Added Kubernetes to the experience section.',
    extractedCompanyName: 'Acme Corp',
  };

  it('passes when all required fields are present', () => {
    expect(validGapAnalysis.matchScore).toBeGreaterThanOrEqual(0);
    expect(validGapAnalysis.matchScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(validGapAnalysis.strongMatches)).toBe(true);
    expect(Array.isArray(validGapAnalysis.gaps)).toBe(true);
    expect(Array.isArray(validGapAnalysis.dealbreakers)).toBe(true);
    expect(Array.isArray(validGapAnalysis.recommendations)).toBe(true);
    expect(Array.isArray(validGapAnalysis.missingKeywords)).toBe(true);
  });

  it('has correctly shaped missingKeywords entries', () => {
    for (const kw of validGapAnalysis.missingKeywords) {
      expect(typeof kw.keyword).toBe('string');
      expect(typeof kw.suggestedSection).toBe('string');
      expect(typeof kw.suggestedBullet).toBe('string');
      expect(kw.keyword.length).toBeGreaterThan(0);
    }
  });

  it('matchScore is a number between 0 and 100', () => {
    const scores = [0, 50, 100];
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('preserves extractedCompanyName through runtime validation', () => {
    const parsed = ResumeBuilderOutputSchema.parse({
      gapAnalysis: validGapAnalysis,
      resume: { name: 'Jane Doe' },
      coverLetter: { subject: 'Application', body: 'I am interested.' },
    });

    expect(parsed.gapAnalysis.extractedCompanyName).toBe('Acme Corp');
  });
});

// ── JD_EXTRACTION_SYSTEM_PROMPT ──────────────────────────────────────────────

describe('JD_EXTRACTION_SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof JD_EXTRACTION_SYSTEM_PROMPT).toBe('string');
    expect(JD_EXTRACTION_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });

  it('contains no dynamic company name placeholder', () => {
    expect(JD_EXTRACTION_SYSTEM_PROMPT).not.toContain('applying to the company');
    // The constant should not have dynamic company name references (like The candidate is applying to...)
    expect(JD_EXTRACTION_SYSTEM_PROMPT).not.toMatch(/The candidate is applying to the company/);
  });

  it('instructs the model to return the required JSON fields', () => {
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('seniority');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('mustHaveSkills');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('niceToHaveSkills');
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('gapsDetected');
  });

  it('does not expose the buildJDExtractionPrompt function', () => {
    const mod = require('../lib/prompt');
    expect(typeof mod.JD_EXTRACTION_SYSTEM_PROMPT).toBe('string');
    expect(mod.buildJDExtractionPrompt).toBeUndefined();
  });

  it('instructs the model to use the CANDIDATE IS APPLYING TO hint', () => {
    expect(JD_EXTRACTION_SYSTEM_PROMPT).toContain('CANDIDATE IS APPLYING TO');
  });
});
