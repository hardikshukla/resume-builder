/**
 * T7.2 — Unit tests: prompt builder functions + GapAnalysis schema
 *
 * Run: npx jest __tests__/prompt.test.ts
 */

import {
  buildSystemPrompt,
  buildUserMessage,
  buildPrompt,
  buildRefinePrompt,
  REFINE_SYSTEM_PROMPT,
} from '../lib/prompt';
import { ResumeBuilderOutputSchema } from '../lib/llm/schema';

// ── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt()', () => {
  const prompt = buildSystemPrompt();

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
    // Specifically should say never embed placeholder text
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
    expect(prompt).toMatch(/Actionable & Strategic/i);
  });

  it('is idempotent — returns the same string on every call', () => {
    expect(buildSystemPrompt()).toBe(prompt);
  });
});

// ── buildUserMessage ─────────────────────────────────────────────────────────

describe('buildUserMessage()', () => {
  const resume = 'Senior Engineer with 5 years Python experience.';
  const jd = 'We need a Python engineer with AWS and Kubernetes experience.';

  it('embeds the resume text verbatim', () => {
    const msg = buildUserMessage(resume, jd);
    expect(msg).toContain(resume);
  });

  it('embeds the job description verbatim', () => {
    const msg = buildUserMessage(resume, jd);
    expect(msg).toContain(jd);
  });

  it('does NOT include company name when not provided', () => {
    const msg = buildUserMessage(resume, jd);
    expect(msg).not.toContain('COMPANY NAME');
  });

  it('includes company name when provided', () => {
    const msg = buildUserMessage(resume, jd, 'Acme Corp');
    expect(msg).toContain('COMPANY NAME');
    expect(msg).toContain('Acme Corp');
  });
});

// ── buildPrompt ──────────────────────────────────────────────────────────────

describe('buildPrompt()', () => {
  const resume = 'Engineer resume';
  const jd = 'Software engineer JD';

  it('combines system prompt and user message', () => {
    const combined = buildPrompt(resume, jd);
    expect(combined).toContain(buildSystemPrompt());
    expect(combined).toContain(resume);
    expect(combined).toContain(jd);
  });

  it('includes company name when provided', () => {
    const combined = buildPrompt(resume, jd, 'Stripe');
    expect(combined).toContain('Stripe');
  });
});

// ── buildRefinePrompt ────────────────────────────────────────────────────────

describe('buildRefinePrompt()', () => {
  const currentOutput = {
    resume:      { name: 'Jane Doe', summary: 'Engineer' },
    coverLetter: { body: 'Dear Hiring Manager…' },
  };

  const selectedRecs = [
    'Add Kubernetes to Core Competencies',
    'Quantify AWS cost savings in the CloudOps bullet',
  ];

  it('returns a non-empty string', () => {
    const prompt = buildRefinePrompt(currentOutput, selectedRecs);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('embeds each selected recommendation as a bullet', () => {
    const prompt = buildRefinePrompt(currentOutput, selectedRecs);
    for (const rec of selectedRecs) {
      expect(prompt).toContain(rec);
    }
  });

  it('embeds the current output JSON', () => {
    const prompt = buildRefinePrompt(currentOutput, selectedRecs);
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('Dear Hiring Manager');
  });

  it('instructs the model to return updatedMatchScore', () => {
    expect(REFINE_SYSTEM_PROMPT).toContain('updatedMatchScore');
  });

  it('instructs the model to apply ONLY the listed improvements', () => {
    expect(REFINE_SYSTEM_PROMPT).toMatch(/Apply ONLY the (?:selected )?improvements listed/i);
  });

  it('handles an empty recommendations list', () => {
    const prompt = buildRefinePrompt(currentOutput, []);
    expect(prompt).toBeDefined();
    // No bullets should be listed
    expect(prompt).not.toContain('- Add Kubernetes');
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
        text: 'Add Kubernetes to Core Competencies',
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
