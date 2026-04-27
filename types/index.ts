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

export interface GapAnalysis {
  matchScore: number;
  strongMatches: string[];
  gaps: string[];
  dealbreakers: string[];
  recommendations: string[];
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
}

export interface CoverLetterData {
  subject: string;
  body: string;
}

export interface ResumeBuilderOutput {
  gapAnalysis: GapAnalysis;
  resume: ResumeData;
  coverLetter: CoverLetterData;
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
  };
  error?: string;
}
