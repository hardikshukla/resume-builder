/**
 * string.ts — Shared string manipulation utilities.
 */

export function toCamelCase(str: string): string {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function toPascalCase(str: string): string {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

export function capitalizeName(name: string): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .map(word => {
      if (word.includes('-')) {
        return word
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function sanitizeFilename(raw: string): string {
  return raw.replace(/\.\./g, '').replace(/[/\\]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '').replace(/[^\w\s\-().+]/g, '')
    .replace(/\s+/g, '_').slice(0, 80) || 'document';
}

export function getTimestampStr() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const full = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return { date, full };
}

/**
 * Builds a download filename in the format: FirstnameLastname_Company[_CoverLetter].docx
 *
 * - candidateName: raw string from the AI, e.g. "John A. Smith"
 * - company: raw company name, e.g. "Google LLC"
 * - type: 'resume' | 'coverLetter'
 *
 * Both name and company are converted to PascalCase tokens joined without separator.
 * Fallbacks: 'Candidate' for name, 'Tailored' for company.
 *
 * Examples:
 *   buildDownloadFilename('John Smith', 'Google')             → 'JohnSmith_Google.docx'
 *   buildDownloadFilename('John Smith', 'Google', 'coverLetter') → 'JohnSmith_Google_CoverLetter.docx'
 *   buildDownloadFilename('', '')                              → 'Candidate_Tailored.docx'
 */
export function buildDownloadFilename(
  candidateName: string,
  company: string,
  type: 'resume' | 'coverLetter' = 'resume'
): string {
  const namePart = toPascalCase(candidateName.trim()) || 'Candidate';
  const companyPart = toPascalCase(company.trim()) || 'Tailored';
  const suffix = type === 'coverLetter' ? '_CoverLetter' : '';
  return `${namePart}_${companyPart}${suffix}.docx`;
}
