/**
 * constants.ts — Shared input size limits.
 */

/** Maximum resume character length accepted by the API. */
export const MAX_RESUME_CHARS = 15_000;

/** Maximum job description character length accepted by the API. */
export const MAX_JD_CHARS = 8_000;

/** Char count at which the UI shows an amber warning (approaching limit). */
export const RESUME_WARN_CHARS = 12_000;

/** Char count at which the UI shows an amber warning for JD. */
export const JD_WARN_CHARS = 6_000;

/** Default Anthropic model name. */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

/** Supported Claude models. */
export const DEFAULT_MODELS = [
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Recommended)' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Fast)' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Advanced)' },
];

/** Fallback mappings when a requested model is unsupported/unavailable. */
export const MODEL_FALLBACKS: Record<string, string> = {
  'claude-3-7-sonnet-latest': 'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-latest': 'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-latest': 'claude-haiku-4-5-20251001',
  'claude-haiku-4-5-latest': 'claude-haiku-4-5-20251001',
};

export interface ModelCapability {
  recommendedFor: 'generation' | 'extraction' | 'advanced' | 'legacy';
  supportsPromptCaching: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  'claude-3-7-sonnet-20250219': { recommendedFor: 'generation', supportsPromptCaching: true },
  'claude-3-7-sonnet-latest': { recommendedFor: 'generation', supportsPromptCaching: true },
  'claude-3-5-sonnet-20241022': { recommendedFor: 'generation', supportsPromptCaching: true },
  'claude-3-5-sonnet-latest': { recommendedFor: 'generation', supportsPromptCaching: true },
  'claude-haiku-4-5-20251001': { recommendedFor: 'extraction', supportsPromptCaching: true },
  'claude-haiku-4-5-latest': { recommendedFor: 'extraction', supportsPromptCaching: true },
  'claude-3-5-haiku-20241022': { recommendedFor: 'extraction', supportsPromptCaching: true },
  'claude-3-5-haiku-latest': { recommendedFor: 'extraction', supportsPromptCaching: true },
  'claude-3-opus-20240229': { recommendedFor: 'advanced', supportsPromptCaching: false },
};

export const getModelCapabilities = (modelId: string): ModelCapability => {
  const normalized = modelId.toLowerCase();
  if (MODEL_CAPABILITIES[normalized]) {
    return MODEL_CAPABILITIES[normalized];
  }
  if (normalized.includes('opus')) {
    return { recommendedFor: 'advanced', supportsPromptCaching: false };
  }
  if (normalized.includes('haiku')) {
    return { recommendedFor: 'extraction', supportsPromptCaching: true };
  }
  if (normalized.includes('sonnet') || normalized.includes('claude-3-7')) {
    return { recommendedFor: 'generation', supportsPromptCaching: true };
  }
  return { recommendedFor: 'legacy', supportsPromptCaching: false };
};

/** Maximum file upload size in bytes (5 MB). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

