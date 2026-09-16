import { buildBoldingKeywords } from '@/lib/utils/boldingKeywords';
import { ResumeBuilderOutput } from '@/types';

function output(gap: Partial<ResumeBuilderOutput['gapAnalysis']>): ResumeBuilderOutput {
  return {
    gapAnalysis: {
      matchScore: 0, strongMatches: [], dealbreakers: [], recommendations: [],
      keywordsAdded: [], summaryChanges: '', ...gap,
    },
    resume: {},
  };
}

const rec = (id: string, claim: string) => ({
  id, claim, targetSection: '', evidenceRequired: '', evidenceFound: '', riskLevel: 'low' as const, resolvesDealbreakers: [],
});

describe('buildBoldingKeywords', () => {
  it('returns nothing without output', () => {
    expect(buildBoldingKeywords(null, null, new Set())).toEqual([]);
  });

  it('collects every source, trimmed, de-duplicated, longest first', () => {
    const result = buildBoldingKeywords(
      output({ strongMatches: [' React ', 'AWS'], keywordsAdded: ['Machine Learning (Skills)', 'AWS'] }),
      { seniority: '', companyName: null, mustHaveSkills: ['TypeScript'], niceToHaveSkills: ['Go'], gapsDetected: [] },
      new Set()
    );
    expect(result).toEqual(['Machine Learning', 'TypeScript', 'React', 'AWS', 'Go']);
  });

  it('adds skill names only from applied recommendations, skipping instruction words', () => {
    const result = buildBoldingKeywords(
      output({ recommendations: [rec('r1', 'Consider adding Kubernetes under Skills'), rec('r2', 'Add Terraform')] }),
      null,
      new Set(['r1'])
    );
    expect(result).toEqual(['Kubernetes']);
  });

  it('drops blank keywords, which would otherwise match between every character', () => {
    const result = buildBoldingKeywords(output({ strongMatches: ['  ', '', 'React'], keywordsAdded: [' (Skills)'] }), null, new Set());
    expect(result).toEqual(['React']);
  });
});
