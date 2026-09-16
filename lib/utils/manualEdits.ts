/**
 * manualEdits.ts — applying inline edits to a generated output, and carrying
 * them across a refine. Pure functions; state lives in hooks/useGenerate.ts.
 */
import { ManualEdit } from '@/types';
import { getAtPath, levenshtein, setAtPath } from '@/lib/utils/path';

/**
 * How far (in character edits) a refined field may drift from the text an edit
 * replaced and still count as the same field, so the edit is re-applied.
 */
export const MERGE_TOLERANCE = 3;

/** `coverLetter.body[N]`: paragraph N of the cover letter body string. */
const COVER_LETTER_PARAGRAPH = /^coverLetter\.body\[(\d+)\]$/;

/** `resume.skills[N].items`: edited as comma-separated text, stored as an array. */
const SKILL_ITEMS = /^resume\.skills\[\d+\]\.items$/;

/** The cover letter body is stored as one string; paragraphs are its non-empty lines. */
function splitParagraphs(body: string | undefined): string[] {
  return (body || '').split('\n').filter(Boolean);
}

function paragraphIndex(path: string): number | null {
  const match = path.match(COVER_LETTER_PARAGRAPH);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * The text an edit at `path` currently points at, or undefined when the field
 * is missing or not text. Skill lists read as "a, b, c".
 */
export function readEditTarget(output: unknown, path: string): string | undefined {
  const index = paragraphIndex(path);
  if (index !== null) {
    return splitParagraphs(getAtPath(output, 'coverLetter.body'))[index] || '';
  }
  const value = getAtPath(output, path);
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' ? value : undefined;
}

/**
 * Returns a copy of `output` with `text` written at `path`. Paragraph edits
 * rewrite the whole body; skill edits are split back into an array.
 */
export function writeEditTarget<T>(output: T, path: string, text: string): T {
  const index = paragraphIndex(path);
  if (index !== null) {
    const paragraphs = splitParagraphs(getAtPath(output, 'coverLetter.body'));
    paragraphs[index] = text;
    return setAtPath(output, 'coverLetter.body', paragraphs.join('\n\n'));
  }
  const value = SKILL_ITEMS.test(path)
    ? text.split(',').map((item) => item.trim()).filter(Boolean)
    : text;
  return setAtPath(output, path, value);
}

/**
 * Adds an edit to the list. Editing the same path again only updates the new
 * text: `originalValue` stays the generated text, so the edit can still be
 * found after a refine.
 */
export function recordEdit(edits: ManualEdit[], edit: ManualEdit): ManualEdit[] {
  const existing = edits.findIndex((e) => e.path === edit.path);
  if (existing === -1) return [...edits, edit];
  return edits.map((e, i) => (i === existing ? { ...e, editedValue: edit.editedValue } : e));
}

/**
 * Re-applies `edits` to a freshly refined output. An edit is kept when its
 * field still holds text within MERGE_TOLERANCE of what the edit replaced;
 * its baseline then moves to the refined text. Otherwise it is orphaned so
 * the UI can show it to the user.
 */
export function mergeManualEdits<T>(
  refined: T,
  edits: ManualEdit[]
): { merged: T; kept: ManualEdit[]; orphaned: ManualEdit[] } {
  let merged = refined;
  const kept: ManualEdit[] = [];
  const orphaned: ManualEdit[] = [];

  for (const edit of edits) {
    const current = readEditTarget(merged, edit.path);
    // levenshtein() is 0 for identical text, so exact matches pass too.
    if (current !== undefined && levenshtein(current, edit.originalValue) <= MERGE_TOLERANCE) {
      merged = writeEditTarget(merged, edit.path, edit.editedValue);
      kept.push({ ...edit, originalValue: current });
    } else {
      orphaned.push(edit);
    }
  }
  return { merged, kept, orphaned };
}
