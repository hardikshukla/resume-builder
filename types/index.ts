// ── LLM Provider Types ────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export interface LLMRequest {
  resume: string;
  jobDescription: string;
  companyName?: string;
  provider: LLMProvider;
  anthropicKey?: string;
  openaiKey?: string;
  anthropicModel?: string;  // overrides ANTHROPIC_MODEL env var
  openaiModel?: string;     // overrides OPENAI_MODEL env var
  ollamaModel?: string;     // overrides OLLAMA_MODEL env var
}

export interface LLMResponse {
  result: ResumeBuilderOutput;
  providerUsed: LLMProvider;
  fallbackOccurred: boolean;
  fallbackReason?: string;
}

// ── Resume Builder Output ─────────────────────────────────────────────────────

/**
 * A keyword from the JD that has no evidence in the candidate's resume.
 * Never embedded in the resume text — surfaced in the UI so the user can
 * consciously decide which ones apply to their experience.
 */
export interface MissingKeyword {
  keyword: string;          // e.g. "Kubernetes"
  suggestedSection: string; // e.g. "Core Competencies"
  suggestedBullet: string;  // e.g. "Orchestrated containerised workloads using Kubernetes"
}

export interface GapAnalysis {
  matchScore: number;
  strongMatches: string[];    // PRESENT — keyword already in resume
  gaps: string[];             // IMPLIED — experience existed, term was added
  dealbreakers: string[];     // MISSING — no evidence in candidate background
  recommendations: string[];  // Actionable suggestions the candidate can selectively apply

  // ── ATS Optimization Summary ─────────────────────────────────────────────────
  keywordsAdded: string[];          // Implied keywords that were woven into the rewrite
  missingKeywords: MissingKeyword[]; // Keywords the user may optionally add via UI
  summaryChanges: string;            // One sentence: what changed in the Summary and why
  extractedCompanyName?: string;     // Extracted company name from the JD
}

export interface ContactInfo {
  email: string;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string;
  bullets: string[];
  tech: string[];            // role-level stack — shown when no projects exist
  projects: ProjectEntry[]; // projects done within this role
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string | null;
}

export interface ProjectEntry {
  name: string;
  description: string;
  bullets: string[];
  link: string | null;
  tech: string[];
}

export interface SkillCategory {
  category: string;   // e.g. "Languages & Frameworks"
  items: string[];    // e.g. ["Java", "Spring Boot", "Kotlin"]
}

export interface ResumeData {
  name: string;
  contact: ContactInfo;
  summary: string;
  skills: SkillCategory[];           // grouped: { category, items }
  experience: ExperienceEntry[];     // projects nested inside each entry
  education: EducationEntry[];
  certifications: string[];
  publications?: string[];           // journal papers, books, conference proceedings
  awards?: string[];                 // honours, prizes, fellowships
  languages?: string[];              // spoken/written languages + proficiency
}

export interface CoverLetterData {
  subject: string;
  body: string;
}

export interface ResumeBuilderOutput {
  gapAnalysis: GapAnalysis;
  resume: ResumeData;
  coverLetter?: CoverLetterData;  // optional — present in normal generation, may be absent if truncated
}

// ── API Types ─────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  resume: string;
  jobDescription: string;
  companyName?: string;
  provider: LLMProvider;
  anthropicKey?: string;
  openaiKey?: string;
  anthropicModel?: string;
  openaiModel?: string;
  ollamaModel?: string;
}

export interface GenerateResponse {
  success: boolean;
  data?: LLMResponse;
  error?: string;
}

export interface DownloadRequest {
  type: 'resume' | 'coverLetter';
  data: ResumeBuilderOutput;
  companyName?: string;
}

export interface RefineRequest {
  currentOutput: ResumeBuilderOutput;      // already-generated result
  selectedRecommendations: string[];       // which recommendations to apply
  provider: LLMProvider;
  anthropicKey?: string;
  openaiKey?: string;
  anthropicModel?: string;
  openaiModel?: string;
  ollamaModel?: string;
}

export interface RefineResponse {
  success: boolean;
  data?: {
    resume: ResumeData;
    coverLetter: CoverLetterData;
    updatedMatchScore?: number; // Re-evaluated ATS score after applying improvements
  };
  error?: string;
}

export interface DropboxSyncRequest {
  resumeData: ResumeBuilderOutput;
  companyName?: string;
  dropboxToken: string;
}
