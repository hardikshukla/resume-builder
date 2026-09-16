/**
 * shared.ts — building blocks common to the resume and cover letter exports.
 *
 * Both documents use the same typeface, page setup and candidate header, so
 * they look like a matched pair. Sizes are in half-points, as docx expects.
 */
import { AlignmentType, BorderStyle, IRunOptions, Paragraph, TextRun } from 'docx';
import { ContactInfo } from '@/types';
import { contactParts } from '@/lib/utils/contact';
import { createKeywordMatcher } from '@/lib/utils/keywords';

export const FONT = 'Times New Roman';

/** Font sizes in half-points (22 = 11pt). */
export const SIZE = {
  name: 28, // 14pt candidate name
  body: 22, // 11pt body text
  stack: 20, // 10pt "Stack:" lines
  link: 18, // 9pt project links
} as const;

/** Run formatting shared by most body text. */
export const BODY_RUN = { font: FONT, size: SIZE.body } as const;

/** US Letter, 1-inch margins (twentieths of a point). */
export const LETTER_PAGE = {
  size: { width: 12240, height: 15840 },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
} as const;

/** Formatting a TextRun can take, minus its content. */
export type RunFormat = Omit<IRunOptions, 'text' | 'children'>;

/**
 * Candidate name, contact line and a thin rule — the top of both documents.
 * Profile links are shortened, matching the on-screen preview.
 */
export function buildCandidateHeader(name?: string, contact?: ContactInfo): Paragraph[] {
  const nameLine = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [
      new TextRun({ text: name ? name.toUpperCase() : 'FIRST LAST', font: FONT, size: SIZE.name, bold: true }),
    ],
  });

  const contactLine = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({ text: contactParts(contact, { shortenUrls: true }).join('  |  '), ...BODY_RUN }),
    ],
  });

  const rule = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'A0A0A0', space: 1 } },
    spacing: { before: 0, after: 200 },
    children: [],
  });

  return [nameLine, contactLine, rule];
}

/**
 * Splits `text` into runs with `format` applied, bolding every whole-word
 * match of `keywords` (the same matching as the on-screen preview).
 */
export function buildTextRunsWithBolding(text: string, keywords: string[] = [], format: RunFormat = {}): TextRun[] {
  if (!text) return [];
  if (keywords.length === 0) {
    return [new TextRun({ ...format, text })];
  }

  const matcher = createKeywordMatcher(keywords);
  return matcher
    .split(text)
    .filter((part) => part !== '')
    .map((part) => new TextRun({ ...format, text: part, bold: matcher.isKeyword(part) ? true : format.bold }));
}
