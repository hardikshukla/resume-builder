/**
 * boldingKeywords.ts — which terms get bolded in the preview and the exports.
 */
import { JDExtractionResult, ResumeBuilderOutput } from '@/types';

/**
 * Capitalised words in a recommendation claim that are instructions or filler
 * rather than skills ("Add", "Consider", "Skills", "The", …).
 */
const CLAIM_STOPWORDS = new Set([
  'add', 'consider', 'under', 'skills', 'experience', 'summary',
  'projects', 'mention', 'use', 'include', 'integrate', 'create',
  'update', 'modify', 'show', 'display', 'highlight', 'demonstrate',
  'provide', 'list', 'write', 'in', 'to', 'the', 'as', 'for', 'with',
  'and', 'or', 'a', 'an', 'at', 'on', 'by',
]);

/** "Kubernetes (Skills)" -> "Kubernetes": keywordsAdded entries name their section. */
function stripSectionSuffix(keyword: string): string {
  return keyword.replace(/ \([^)]+\)$/, '');
}

/** Likely skill names in a claim: capitalised words that are not stopwords. */
function claimTerms(claim: string): string[] {
  return claim
    .split(/[\s,.:;()'"?]+/)
    .map((word) => word.trim())
    .filter((word) => /^[A-Z]/.test(word) && !CLAIM_STOPWORDS.has(word.toLowerCase()));
}

/**
 * Every term to bold, longest first so multi-word phrases win over the
 * shorter terms they contain. Sources: strong matches, keywords added during
 * tailoring, the JD's must-have and nice-to-have skills, and skill names from
 * recommendations the user has applied.
 */
export function buildBoldingKeywords(
  output: ResumeBuilderOutput | null,
  jdKeywords: JDExtractionResult | null,
  appliedRecommendationIds: ReadonlySet<string>
): string[] {
  if (!output) return [];
  const { gapAnalysis } = output;

  const candidates = [
    ...gapAnalysis.strongMatches,
    ...gapAnalysis.keywordsAdded.map((kw) => (kw ? stripSectionSuffix(kw) : kw)),
    ...(jdKeywords?.mustHaveSkills ?? []),
    ...(jdKeywords?.niceToHaveSkills ?? []),
    ...(gapAnalysis.recommendations ?? [])
      .filter((rec) => appliedRecommendationIds.has(rec.id))
      .flatMap((rec) => claimTerms(rec.claim)),
  ];

  // An empty keyword would make the bolding regex match between every
  // character, so blank entries are dropped after trimming.
  const keywords = new Set(candidates.map((kw) => (kw ?? '').trim()).filter(Boolean));
  return Array.from(keywords).sort((a, b) => b.length - a.length);
}
