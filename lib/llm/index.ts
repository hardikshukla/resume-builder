import { LLMProvider, LLMRequest, LLMResponse, ResumeBuilderOutput } from '@/types';
import { buildPrompt } from '@/lib/prompt';
import { callAnthropic } from './anthropic';
import { callOpenAI } from './openai';
import { callOllama } from './ollama';

const FALLBACK_ORDER: LLMProvider[] = ['anthropic', 'openai', 'openrouter', 'ollama'];
const TIMEOUT_MS = 180_000; // 3 minutes — large prompts can take 90-120s

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Provider timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function getKey(
  provider: LLMProvider,
  anthropicKey?: string,
  openaiKey?: string,
  openrouterKey?: string
): string | undefined {
  if (provider === 'anthropic')  return anthropicKey;
  if (provider === 'openai')     return openaiKey;
  if (provider === 'openrouter') return openrouterKey;
  return undefined; // Ollama needs no key
}

function hasKey(
  provider: LLMProvider,
  anthropicKey?: string,
  openaiKey?: string,
  openrouterKey?: string
): boolean {
  if (provider === 'ollama') return true; // always available if server is running
  const key = getKey(provider, anthropicKey, openaiKey, openrouterKey);
  return !!key && key.trim().length > 0;
}

type SectionKey = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';

async function callProvider(
  provider: LLMProvider,
  prompt: string,
  anthropicKey?: string,
  openaiKey?: string,
  openrouterKey?: string,
  anthropicModel?: string,
  openaiModel?: string,
  ollamaModel?: string,
  openrouterModel?: string,
  // Structured args passed separately to Anthropic for system/user split
  resume?: string,
  jd?: string,
  companyName?: string,
  sections: SectionKey[] | 'all' = 'all'
): Promise<ResumeBuilderOutput> {
  const key = getKey(provider, anthropicKey, openaiKey, openrouterKey);

  switch (provider) {
    case 'anthropic':
      if (!key) throw new Error('No Anthropic API key provided');
      return withTimeout(
        callAnthropic(prompt, key, anthropicModel, resume, jd, companyName, sections),
        TIMEOUT_MS
      );

    case 'openai':
      if (!key) throw new Error('No OpenAI API key provided');
      return withTimeout(callOpenAI(prompt, key, openaiModel, 'openai'), TIMEOUT_MS);

    case 'openrouter':
      if (!key) throw new Error('No OpenRouter API key provided');
      return withTimeout(callOpenAI(prompt, key, openrouterModel, 'openrouter'), TIMEOUT_MS);

    case 'ollama':
      return withTimeout(callOllama(prompt, ollamaModel), TIMEOUT_MS);
  }
}

export async function runLLM(request: LLMRequest): Promise<LLMResponse> {
  const prompt = buildPrompt(
    request.resume,
    request.jobDescription,
    request.companyName,
    request.sections
  );

  // Build fallback chain: requested provider first, then rest in order
  // Skip any provider that has no key configured (prevents passing wrong keys)
  const allProviders: LLMProvider[] = [
    request.provider,
    ...FALLBACK_ORDER.filter((p) => p !== request.provider),
  ];

  const chain = allProviders.filter((p) =>
    hasKey(p, request.anthropicKey, request.openaiKey, request.openrouterKey)
  );

  if (chain.length === 0) {
    throw new Error(
      'No providers available. Please enter an API key for at least one provider.'
    );
  }

  const errors: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const fallbackOccurred = i > 0;

    try {
      const result = await callProvider(
        provider,
        prompt,
        request.anthropicKey,
        request.openaiKey,
        request.openrouterKey,
        request.anthropicModel,
        request.openaiModel,
        request.ollamaModel,
        request.openrouterModel,
        request.resume,
        request.jobDescription,
        request.companyName,
        request.sections
      );
      return {
        result,
        providerUsed: provider,
        fallbackOccurred,
        fallbackReason: fallbackOccurred
          ? `${chain[i - 1]} failed — ${errors[errors.length - 1]}`
          : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      console.error(`[LLM] Provider ${provider} failed:`, msg);
    }
  }

  throw new Error(`All available providers failed:\n${errors.join('\n')}`);
}
