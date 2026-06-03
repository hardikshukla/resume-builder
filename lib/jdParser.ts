/**
 * jdParser.ts
 * Parses structural signals (seniority level, company name) from a job description
 * using regex heuristics.
 */

export function parseJdStructure(jdText: string): {
  seniority: string;
  companyName: string | null;
} {
  // 1. Try to extract seniority via years of experience regex or keywords
  let seniority = 'Mid / Unspecified';
  const yoeRegex = /(\b\d+(?:-\d+)?\+?\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience|exp)?)/i;
  const yoeMatch = jdText.match(yoeRegex);
  if (yoeMatch) {
    seniority = yoeMatch[1].trim();
  } else if (/\b(lead|principal|director|head|vp)\b/i.test(jdText)) {
    const match = jdText.match(/\b(lead|principal|director|head|vp)\b/i);
    seniority = match ? match[1] : 'Lead';
  } else if (/\b(senior|sr\.)\b/i.test(jdText)) {
    seniority = 'Senior';
  } else if (/\b(junior|jr\.|entry[- ]level|intern|associate)\b/i.test(jdText)) {
    seniority = 'Entry / Junior';
  }

  // 2. Try to extract company name via common prefix phrases
  // e.g. "at Google", "joining Netflix", "welcome to Microsoft", "role at Stripe"
  let companyName: string | null = null;
  const companyPhrases = [
    /\b(?:at|joining|join|welcome\s+to|role\s+at)\s+([A-Z][a-zA-Z0-9\s&]{1,30}?)(?:\s+is|\s+looks|\s+seeks|\s+team|\b|\.|\,)/,
    /\bAbout\s+([A-Z][a-zA-Z0-9\s&]{1,30}?)(?:\s+is|\s+looks|\s+seeks|\s+team|\b|\.|\,)/i
  ];

  for (const regex of companyPhrases) {
    const match = jdText.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filter out common words/false positives
      if (!/^(the|a|this|our|we|you|your|work|role|job|position|team|remote|hybrid|onsite)$/i.test(candidate)) {
        companyName = candidate;
        break;
      }
    }
  }

  return { seniority, companyName };
}
