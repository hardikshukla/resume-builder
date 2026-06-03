import {
  MAX_CURRENT_OUTPUT_JSON_CHARS,
  MAX_SELECTED_RECOMMENDATIONS,
  validateGenerateRequest,
} from '../lib/validation/generateRequest';

const recommendation = {
  id: 'custom-1',
  claim: 'Add Terraform to Core Competencies',
  targetSection: 'User Custom Instruction',
  evidenceRequired: 'User supplied',
  evidenceFound: 'User supplied',
  riskLevel: 'medium' as const,
  resolvesDealbreakers: [],
};

describe('validateGenerateRequest()', () => {
  it('accepts a normal generate request', () => {
    const result = validateGenerateRequest({
      mode: 'generate',
      resume: 'Experienced engineer',
      jobDescription: 'Hiring a backend engineer',
      model: 'claude-3-5-sonnet-20241022',
    });

    expect(result.success).toBe(true);
  });

  it('accepts bounded user-supplied refinement instructions', () => {
    const result = validateGenerateRequest({
      mode: 'refine',
      currentOutput: {
        resume: { name: 'Jane Doe', summary: 'Engineer' },
        coverLetter: { subject: 'Application', body: 'Interested.' },
      },
      selectedRecommendations: [recommendation],
    });

    expect(result.success).toBe(true);
  });

  it('rejects too many selected recommendations', () => {
    const result = validateGenerateRequest({
      mode: 'refine',
      currentOutput: { resume: { name: 'Jane Doe' } },
      selectedRecommendations: Array.from(
        { length: MAX_SELECTED_RECOMMENDATIONS + 1 },
        (_, index) => ({ ...recommendation, id: `custom-${index}` })
      ),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(`at most ${MAX_SELECTED_RECOMMENDATIONS}`);
    }
  });

  it('rejects refine requests without a current resume object', () => {
    const result = validateGenerateRequest({
      mode: 'refine',
      currentOutput: { coverLetter: { body: 'Interested.' } },
      selectedRecommendations: [recommendation],
    });

    expect(result.success).toBe(false);
  });

  it('rejects oversized custom recommendation text', () => {
    const result = validateGenerateRequest({
      mode: 'refine',
      currentOutput: { resume: { name: 'Jane Doe' } },
      selectedRecommendations: [
        {
          ...recommendation,
          claim: 'x'.repeat(501),
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects oversized current output payloads', () => {
    const result = validateGenerateRequest({
      mode: 'refine',
      currentOutput: {
        resume: {
          summary: 'x'.repeat(MAX_CURRENT_OUTPUT_JSON_CHARS),
        },
      },
      selectedRecommendations: [recommendation],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('too large to refine');
    }
  });

  // ── jdKeywords passthrough tests ──────────────────────────────────────────

  const validJdKeywords = {
    seniority: 'Senior',
    companyName: 'Acme Corp',
    mustHaveSkills: ['TypeScript', 'Node.js'],
    niceToHaveSkills: ['GraphQL'],
    gapsDetected: ['No Kubernetes experience'],
  };

  it('accepts jdKeywords in generate mode and preserves all fields', () => {
    const result = validateGenerateRequest({
      mode: 'generate',
      resume: 'Experienced engineer',
      jobDescription: 'Hiring a backend engineer',
      jdKeywords: validJdKeywords,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Confirm the field is not stripped
      expect(result.data.jdKeywords).toBeDefined();
      expect(result.data.jdKeywords?.seniority).toBe('Senior');
      expect(result.data.jdKeywords?.mustHaveSkills).toEqual(['TypeScript', 'Node.js']);
    }
  });

  it('accepts jdKeywords in refine mode and preserves all fields', () => {
    const result = validateGenerateRequest({
      mode: 'refine',
      currentOutput: {
        resume: { name: 'Jane Doe', summary: 'Engineer' },
        coverLetter: { subject: 'Application', body: 'Interested.' },
      },
      selectedRecommendations: [recommendation],
      jdKeywords: validJdKeywords,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jdKeywords).toBeDefined();
      expect(result.data.jdKeywords?.companyName).toBe('Acme Corp');
    }
  });

  it('omitting jdKeywords is still valid (optional field)', () => {
    const result = validateGenerateRequest({
      mode: 'generate',
      resume: 'Experienced engineer',
      jobDescription: 'Hiring a backend engineer',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jdKeywords).toBeUndefined();
    }
  });

  it('rejects jdKeywords with missing required fields', () => {
    const result = validateGenerateRequest({
      mode: 'generate',
      resume: 'Experienced engineer',
      jobDescription: 'Hiring a backend engineer',
      jdKeywords: {
        // missing seniority, companyName, gapsDetected
        mustHaveSkills: ['TypeScript'],
        niceToHaveSkills: [],
      },
    });

    expect(result.success).toBe(false);
  });
});
