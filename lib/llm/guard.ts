/**
 * guard.ts — Post-generation output integrity checks.
 *
 * Called immediately after JSON.parse in every provider adapter.
 * If the LLM slips placeholder text or other forbidden patterns into
 * the output despite prompt-level instructions, these guards catch it
 * before the data reaches React state or DOCX generation.
 */

const PLACEHOLDER_RE = /\[PLACEHOLDER[:\s]/i;

/**
 * Recursively walks the parsed LLM output and throws if any string value
 * contains a PLACEHOLDER token. Reports the JSON path of the offending field
 * so the error message is actionable.
 */
export function guardOutput(output: unknown, path = 'root'): void {
  if (typeof output === 'string') {
    if (PLACEHOLDER_RE.test(output)) {
      throw new Error(
        `LLM returned placeholder text at "${path}". ` +
        `This is a prompt compliance issue — please try again. ` +
        `If it recurs consistently, report the job description to the maintainer.`
      );
    }
    return;
  }

  if (Array.isArray(output)) {
    output.forEach((item, i) => guardOutput(item, `${path}[${i}]`));
    return;
  }

  if (output !== null && typeof output === 'object') {
    for (const [key, value] of Object.entries(output)) {
      guardOutput(value, `${path}.${key}`);
    }
  }
}
