// ── LLM Configuration Types ────────────────────────────────────────────────────

export type GenerationMode = 'generate' | 'refine';

// ── Resume Builder Output ─────────────────────────────────────────────────────

export interface Dealbreaker {
  id: string;               // e.g. "db-1"
  text: string;             // e.g. "No Kubernetes experience"
}

export interface Recommendation {
  id: string;               // e.g. "rec-1"
  text: string;             // e.g. "Add Kubernetes under Skills and experience"
  resolvesDealbreakers: string[]; // references IDs of Dealbreakers resolved
}

export interface MissingKeyword {
  id: string;               // e.g. "kw-kubernetes"
  keyword: string;          // e.g. "Kubernetes"
  suggestedSection: string; // e.g. "Core Competencies"
  suggestedBullet: string;  // e.g. "Orchestrated containerised workloads using Kubernetes"
}

export interface GapAnalysis {
  matchScore: number;
  strongMatches: string[];    // PRESENT — keyword already in resume
  gaps: string[];             // IMPLIED — experience existed, term was added
  dealbreakers: Dealbreaker[]; // MISSING — no evidence in candidate background
  recommendations: Recommendation[]; // Actionable suggestions the candidate can selectively apply
  keywordsAdded: string[];          // Implied keywords that were woven into the resume rewrite
  missingKeywords: MissingKeyword[]; // Keywords the user may optionally add via UI
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

export interface ResumeBuilderOutput {
  gapAnalysis: GapAnalysis;
  resume: ResumeData;
  coverLetter?: CoverLetterData;
}

// ── API Types ─────────────────────────────────────────────────────────────────

export interface GenerateRequest {
  resume: string;
  jobDescription: string;
  companyName?: string;
  anthropicKey?: string;     // falls back to ANTHROPIC_API_KEY env var
  mode: GenerationMode;
  currentOutput?: ResumeBuilderOutput;   // refine mode only
  selectedRecommendations?: string[];    // refine mode only
}

export interface GenerateResponse {
  success: boolean;
  data?: ResumeBuilderOutput;
  error?: string;
}

export interface DropboxSyncRequest {
  resumeData: ResumeBuilderOutput;
  companyName?: string;
  dropboxToken: string;
}

