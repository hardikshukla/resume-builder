import { ResumeData } from '@/types';

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

export function resumeDataToText(r: ResumeData): string {
  const parts: string[] = [];
  if (r.name) parts.push(r.name);
  if (r.contact) {
    const c = r.contact;
    const contactLine = [c.email, c.phone, c.linkedin, c.github, c.location].filter(Boolean).join(' | ');
    if (contactLine) parts.push(contactLine);
  }
  if (r.summary) {
    parts.push('\nSUMMARY');
    parts.push(r.summary);
  }
  if (r.skills && r.skills.length > 0) {
    parts.push('\nSKILLS');
    for (const sg of r.skills) {
      parts.push(`${sg.category}: ${sg.items.join(', ')}`);
    }
  }
  if (r.experience && r.experience.length > 0) {
    parts.push('\nEXPERIENCE');
    for (const exp of r.experience) {
      parts.push(`${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate})`);
      if (exp.location) parts.push(exp.location);
      for (const b of exp.bullets) {
        parts.push(`- ${b}`);
      }
      if (exp.projects && exp.projects.length > 0) {
        for (const proj of exp.projects) {
          parts.push(`  Project: ${proj.name}`);
          if (proj.description) parts.push(`  ${proj.description}`);
          for (const pb of proj.bullets) {
            parts.push(`  - ${pb}`);
          }
          if (proj.tech && proj.tech.length > 0) {
            parts.push(`  Stack: ${proj.tech.join(', ')}`);
          }
        }
      }
      if (exp.tech && exp.tech.length > 0) {
        parts.push(`  Stack: ${exp.tech.join(', ')}`);
      }
    }
  }
  if (r.projects && r.projects.length > 0) {
    parts.push('\nPROJECTS');
    for (const proj of r.projects) {
      parts.push(`${proj.name}`);
      if (proj.description) parts.push(proj.description);
      for (const b of proj.bullets) {
        parts.push(`- ${b}`);
      }
      if (proj.tech && proj.tech.length > 0) {
        parts.push(`Stack: ${proj.tech.join(', ')}`);
      }
    }
  }
  if (r.education && r.education.length > 0) {
    parts.push('\nEDUCATION');
    for (const edu of r.education) {
      parts.push(`${edu.degree} - ${edu.institution} (${edu.year || ''})`);
    }
  }
  if (r.certifications && r.certifications.length > 0) {
    parts.push('\nCERTIFICATIONS');
    parts.push(r.certifications.join('\n'));
  }
  return parts.join('\n');
}
