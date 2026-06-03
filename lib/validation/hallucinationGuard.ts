import { ResumeData, HallucinationReport, HallucinatedClaim } from '@/types';

// Levenshtein distance calculation helper
function getLevenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }
  return dp[a.length][b.length];
}

// Remove commas from inside numbers (e.g. "1,200,000" -> "1200000")
function preprocessText(t: string): string {
  return t.replace(/(\d),(\d)/g, '$1$2');
}

// Extract metric values and expand scales (k -> 1000, m -> 1000000, etc.)
export function extractMetrics(text: string): string[] {
  const cleaned = preprocessText(text);
  const regex = /\b(\d+(?:\.\d+)?)\s*(k|m|b|million|billion|thousand|%|x)?(?!\w)/gi;
  const results: string[] = [];
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const rawVal = parseFloat(match[1]);
    const suffix = (match[2] || '').toLowerCase();
    
    if (suffix === 'k' || suffix === 'thousand') {
      results.push(String(rawVal * 1000));
    } else if (suffix === 'm' || suffix === 'million') {
      results.push(String(rawVal * 1000000));
    } else if (suffix === 'b' || suffix === 'billion') {
      results.push(String(rawVal * 1000000000));
    } else if (suffix === '%' || suffix === 'x') {
      results.push(rawVal + suffix);
    } else {
      results.push(String(rawVal));
    }
  }
  return results;
}

// Checks if target string is found as substring or matched fuzzily in sourceText
function isFuzzyMatched(target: string, sourceText: string): boolean {
  const normTarget = target.trim().toLowerCase();
  const normSource = sourceText.toLowerCase();
  if (normSource.includes(normTarget)) return true;

  if (normTarget.length < 3) return false;

  // Sliding window matching for fuzzy detection
  const targetLen = normTarget.length;
  for (let i = 0; i <= normSource.length - targetLen; i++) {
    const windowStr = normSource.slice(i, i + targetLen);
    if (getLevenshteinDistance(normTarget, windowStr) <= 2) {
      return true;
    }
  }
  return false;
}

export function verifyHallucinations(
  originalResumeText: string,
  generatedResume: ResumeData
): HallucinationReport {
  const flaggedClaims: HallucinatedClaim[] = [];

  // ── 1. Company Name verification ──────────────────────────────────────────
  if (generatedResume.experience) {
    for (const exp of generatedResume.experience) {
      if (exp.company && !isFuzzyMatched(exp.company, originalResumeText)) {
        flaggedClaims.push({
          text: exp.company,
          reason: `Company "${exp.company}" is not mentioned in your original resume.`,
        });
      }
      
      // Date verification
      if (exp.startDate && !isFuzzyMatched(exp.startDate, originalResumeText)) {
        flaggedClaims.push({
          text: exp.startDate,
          reason: `Start date "${exp.startDate}" is not mentioned in your original resume.`,
        });
      }
      if (
        exp.endDate &&
        exp.endDate.toLowerCase() !== 'present' &&
        exp.endDate.toLowerCase() !== 'current' &&
        !isFuzzyMatched(exp.endDate, originalResumeText)
      ) {
        flaggedClaims.push({
          text: exp.endDate,
          reason: `End date "${exp.endDate}" is not mentioned in your original resume.`,
        });
      }
    }
  }

  // ── 2. Degree verification ────────────────────────────────────────────────
  if (generatedResume.education) {
    for (const edu of generatedResume.education) {
      if (edu.degree && !isFuzzyMatched(edu.degree, originalResumeText)) {
        flaggedClaims.push({
          text: edu.degree,
          reason: `Degree "${edu.degree}" is not mentioned in your original resume.`,
        });
      }
    }
  }

  // ── 3. Metrics and Numbers verification ──────────────────────────────────
  const generatedText = JSON.stringify(generatedResume);
  const genMetrics = extractMetrics(generatedText);
  const origMetrics = new Set(extractMetrics(originalResumeText));

  for (const metric of genMetrics) {
    // Skip years (e.g. 2021, 1999) to avoid double warning on dates
    const isYear = /^(19|20)\d{2}$/.test(metric);
    // Skip tiny numbers <= 10
    const isSmallNumber = /^\d+$/.test(metric) && parseInt(metric, 10) <= 10;
    
    if (isYear || isSmallNumber) continue;

    if (!origMetrics.has(metric)) {
      flaggedClaims.push({
        text: metric,
        reason: `Metric or percentage value "${metric}" was not found in your original resume.`,
      });
    }
  }

  return {
    passed: flaggedClaims.length === 0,
    flaggedClaims,
  };
}
