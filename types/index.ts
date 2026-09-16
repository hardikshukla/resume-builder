// ── LLM Configuration Types ────────────────────────────────────────────────────

export type GenerationMode = 'generate' | 'refine';

// ── Resume Builder Output ─────────────────────────────────────────────────────

export interface Dealbreaker {
  id: string;               // e.g. "db-1"
  text: string;             // e.g. "No Kubernetes experience"
}

export interface Recommendation {
  id: string;               // e.g. "rec-1"
  claim: string;             // e.g. "Add Kubernetes"
  targetSection: string;     // e.g. "Core Competencies"
  evidenceRequired: string;  // e.g. "Hands-on experience with Kubernetes orchestration"
  evidenceFound: string;     // e.g. "None found in original resume"
  riskLevel: 'low' | 'medium' | 'high'; // Risk level of adding this claim
  resolvesDealbreakers: string[]; // references IDs of Dealbreakers resolved
}

export interface ScoreBreakdown {
  summary: number;
  skills: number;
  experience: number;
  dealbreakersDeducted: number;
}

export interface GapAnalysis {
  matchScore: number;
  scoreBreakdown?: ScoreBreakdown;
  strongMatches: string[];    // PRESENT — keyword already in resume
  dealbreakers: Dealbreaker[]; // MISSING — no evidence in candidate background
  recommendations: Recommendation[]; // Actionable suggestions the candidate can selectively apply
  keywordsAdded: string[];          // Implied keywords that were woven into the resume rewrite
  summaryChanges: string;            // One sentence: what changed in the Summary and why
  extractedCompanyName?: string | null; // Extracted company name from the JD
}

export interface ContactInfo {
  email: string;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  location: string | null;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string;
  bullets: string[];
  tech: string[];            // role-level stack
  projects: ProjectEntry[]; // projects done within this role
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string | null;
}

export interface ProjectEntry {
  name: string;
  description: string | null;
  bullets: string[];
  link: string | null;
  tech: string[];
}

export interface SkillCategory {
  category: string;   // e.g. "Languages & Frameworks"
  items: string[];    // e.g. ["Java", "Spring Boot", "Kotlin"]
}

export interface ResumeData {
  name?: string;
  contact?: ContactInfo;
  summary?: string;
  skills?: SkillCategory[];           // grouped: { category, items }
  experience?: ExperienceEntry[];     // projects nested inside each entry
  projects?: ProjectEntry[];          // standalone projects
  education?: EducationEntry[];
  certifications?: string[];
  publications?: string[];
  awards?: string[];
  languages?: string[];
}

export interface CoverLetterData {
  subject: string;
  body: string;
}

export interface HallucinatedClaim {
  text: string;
  reason: string;
}

export interface HallucinationReport {
  passed: boolean;
  flaggedClaims: HallucinatedClaim[];
}

export interface ResumeBuilderOutput {
  gapAnalysis: GapAnalysis;
  resume: ResumeData;
  coverLetter?: CoverLetterData;
  hallucinationReport?: HallucinationReport;
}

// ── API Types ─────────────────────────────────────────────────────────────────

export interface JDExtractionResult {
  seniority: string;
  companyName: string | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  gapsDetected: string[];
}

export interface GenerateRequest {
  resume: string;
  jobDescription: string;
  companyName?: string;
  anthropicKey?: string;     // falls back to ANTHROPIC_API_KEY env var
  model?: string;            // Claude model override
  mode: GenerationMode;
  currentOutput?: ResumeBuilderOutput;   // refine mode only
  selectedRecommendations?: Recommendation[];    // refine mode only
  jdKeywords?: JDExtractionResult; // pre-extracted keywords context
}


/**
 * Result of a background credential check (Anthropic key, Dropbox token).
 * Callers hold `FieldStatus | null`, where null means "not checked yet"; the
 * in-progress spinner is driven by a separate boolean.
 */
export interface FieldStatus {
  ok: boolean;
  message: string;
}

/** A Claude model the user can pick in the model selector. */
export interface ModelOption {
  id: string;
  /** Display name, e.g. "Claude Sonnet 4.6". Also shown in the context pill. */
  name: string;
  /** Short qualifier shown after the name in the picker, e.g. "Recommended". */
  hint?: string;
}

/**
 * A user's inline edit to the generated output. `path` uses bracket notation
 * (e.g. `resume.experience[0].bullets[2]`, or `coverLetter.body[1]` for a
 * cover letter paragraph). `originalValue` is the generated text the edit
 * replaced; it is how the edit is re-located after a refine.
 */
export interface ManualEdit {
  path: string;
  originalValue: string;
  editedValue: string;
}
