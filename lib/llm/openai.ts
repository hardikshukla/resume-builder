import OpenAI from 'openai';
import { ResumeBuilderOutput } from '@/types';
import { guardOutput } from '@/lib/llm/guard';
import { ResumeBuilderOutputSchema } from '@/lib/llm/schema';

const DEFAULT_MODEL        = process.env.OPENAI_MODEL      ?? 'gpt-4o';
const OPENROUTER_BASE_URL  = 'https://openrouter.ai/api/v1';
const OPENROUTER_DEFAULT   = process.env.OPENROUTER_MODEL  ?? 'google/gemma-3-27b-it:free';

export async function callOpenAI(
  prompt: string,
  apiKey: string,
  modelOverride?: string,
  /** Pass 'openrouter' to route through OpenRouter instead of api.openai.com */
  variant?: 'openai' | 'openrouter'
): Promise<ResumeBuilderOutput> {
  const isOpenRouter = variant === 'openrouter';
  const model = modelOverride || (isOpenRouter ? OPENROUTER_DEFAULT : DEFAULT_MODEL);

  const client = new OpenAI({
    apiKey,
    ...(isOpenRouter && {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hardikshukla/resume-builder',
        'X-Title': 'AI Resume Builder',
      },
    }),
  });

  const response = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are an expert career strategist. Always respond with valid JSON only.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const choice = response.choices[0];

  if (choice?.finish_reason === 'length') {
    throw new Error(
      `${isOpenRouter ? 'OpenRouter' : 'OpenAI'} response was cut off (resume too long). ` +
      'Try shortening your resume or switching to a model with a larger output limit.'
    );
  }

  const raw = choice?.message?.content ?? '';
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  let parsed: ResumeBuilderOutput;
  try {
    const raw_parsed = JSON.parse(cleaned);
    const result = ResumeBuilderOutputSchema.safeParse(raw_parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg   = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } catch (e) {
    if (e instanceof Error && e.message.includes('failed validation')) throw e;
    throw new Error(
      `${isOpenRouter ? 'OpenRouter' : 'OpenAI'} returned invalid JSON. This can happen with very long resumes or content ` +
      'filter responses. Try again, or switch to a different model.'
    );
  }

  guardOutput(parsed);
  return parsed;
}
