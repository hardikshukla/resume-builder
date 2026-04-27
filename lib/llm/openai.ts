import OpenAI from 'openai';
import { ResumeBuilderOutput } from '@/types';

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

  const raw = response.choices[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned) as ResumeBuilderOutput;
}
