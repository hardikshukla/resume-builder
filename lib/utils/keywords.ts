/**
 * keywords.ts — whole-word keyword matching, shared by the on-screen preview
 * (lib/utils/highlight.tsx) and both Word exports (lib/docx/shared.ts), so a
 * keyword is bolded in exactly the same places everywhere.
 */

/** Escapes characters that have special meaning in a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Regex pattern for one keyword. Word boundaries are asserted only on sides
 * that start/end with a word character, so "C++" or ".NET" still match even
 * though `\b` would fail next to their punctuation.
 */
function keywordPattern(keyword: string): string {
  let pattern = escapeRegExp(keyword);
  if (/^\w/.test(keyword)) pattern = '(?<!\\w)' + pattern;
  if (/\w$/.test(keyword)) pattern = pattern + '(?!\\w)';
  return pattern;
}

export interface KeywordMatcher {
  /**
   * Splits text on keyword matches. Matched keywords are kept as their own
   * parts (the pattern has a capture group); parts may be empty strings.
   */
  split(text: string): string[];
  /** True when `part` is one of the keywords, ignoring case. */
  isKeyword(part: string): boolean;
}

/**
 * Builds a case-insensitive matcher for `keywords`. Callers pass longer
 * phrases first so they win over shorter substrings (see page.tsx).
 */
export function createKeywordMatcher(keywords: string[]): KeywordMatcher {
  const regex = new RegExp(`(${keywords.map(keywordPattern).join('|')})`, 'gi');
  const lowercase = new Set(keywords.map((keyword) => keyword.toLowerCase()));
  return {
    split: (text) => text.split(regex),
    isKeyword: (part) => lowercase.has(part.toLowerCase()),
  };
}
