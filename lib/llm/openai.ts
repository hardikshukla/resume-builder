import OpenAI from 'openai';
import { ResumeBuilderOutput } from '@/types';
import { guardOutput } from '@/lib/llm/guard';
import { ResumeBuilderOutputSchema } from '@/lib/llm/schema';

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o';

export async function callOpenAI(
  prompt: string,
  apiKey: string,
  modelOverride?: string
): Promise<ResumeBuilderOutput> {
  const client = new OpenAI({ apiKey });
  const model = modelOverride || DEFAULT_MODEL;

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
      'OpenAI response was cut off (resume too long). Try shortening your resume or ' +
      'switching to a model with a larger output limit.'
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
      throw new Error(`OpenAI response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } catch (e) {
    if (e instanceof Error && e.message.includes('failed validation')) throw e;
    throw new Error(
      'OpenAI returned invalid JSON. This can happen with very long resumes or content ' +
      'filter responses. Try again, or switch to a different model.'
    );
  }

  guardOutput(parsed);
  return parsed;
}

