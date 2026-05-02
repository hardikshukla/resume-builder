/**
 * dispatch.ts — Thin provider router for one-off prompt calls.
 *
 * Returns raw text from the provider with no JSON parsing or schema
 * validation — callers are responsible for both. Used by routes that need
 * a different output schema from the generate path (e.g. /api/refine).
 *
 * The /api/generate route uses runLLM() instead, which adds timeouts,
 * fallback chains, and full Zod validation.
 */

import { LLMProvider } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

export interface DispatchConfig {
  provider:       LLMProvider;
  anthropicKey?:  string;
  openaiKey?:     string;
  anthropicModel?: string;
  openaiModel?:   string;
  ollamaModel?:   string;
}

const ANTHROPIC_DEFAULT = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
const OPENAI_DEFAULT    = process.env.OPENAI_MODEL    ?? 'gpt-4o';
const OLLAMA_DEFAULT    = process.env.OLLAMA_MODEL    ?? 'llama3';
const OLLAMA_BASE_URL   = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

/**
 * Route a prompt to a provider and return the raw response text.
 * No JSON parsing, no validation — the caller owns that.
 */
export async function dispatchRaw(
  prompt: string,
  config: DispatchConfig
): Promise<string> {
  const { provider, anthropicKey, openaiKey, anthropicModel, openaiModel, ollamaModel } = config;

  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    if (!anthropicKey) throw new Error('No Anthropic API key provided.');
    const model = anthropicModel || ANTHROPIC_DEFAULT;
    const client = new Anthropic({ apiKey: anthropicKey });

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }] }],
    });

    if (response.stop_reason === 'max_tokens') {
      throw new Error(
        'Refine response was cut off. Try selecting fewer recommendations at once.'
      );
    }
    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected non-text response from Anthropic.');
    return content.text.trim();
  }

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  if (provider === 'openai') {
    if (!openaiKey) throw new Error('No OpenAI API key provided.');
    const model = openaiModel || OPENAI_DEFAULT;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${err}`);
    }

    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  // ── Ollama ─────────────────────────────────────────────────────────────────
  if (provider === 'ollama') {
    const model = ollamaModel || OLLAMA_DEFAULT;
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama error ${res.status}: ${err}`);
    }

    const data = await res.json() as { response: string };
    return data.response.trim();
  }

  throw new Error(`Unknown provider: ${provider}`);
}
