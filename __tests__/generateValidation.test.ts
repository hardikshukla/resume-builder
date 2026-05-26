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
});
