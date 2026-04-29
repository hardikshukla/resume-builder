import { ResumeBuilderOutput } from '@/types';
import { guardOutput } from '@/lib/llm/guard';
import { ResumeBuilderOutputSchema } from '@/lib/llm/schema';

const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'llama3';

export async function callOllama(
  prompt: string,
  modelOverride?: string
): Promise<ResumeBuilderOutput> {
  const model = modelOverride || DEFAULT_MODEL;

  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404) {
      throw new Error(
        `Ollama model "${model}" is not installed. ` +
        `Use the "Fetch models" button to see what's available, ` +
        `or run: ollama pull ${model}`
      );
    }
    throw new Error(`Ollama HTTP ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { response: string };
  const raw = data.response.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  let parsed: ResumeBuilderOutput;
  try {
    const raw_parsed = JSON.parse(cleaned);
    const result = ResumeBuilderOutputSchema.safeParse(raw_parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg   = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Ollama response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } catch (e) {
    if (e instanceof Error && e.message.includes('failed validation')) throw e;
    throw new Error(
      'Ollama returned invalid JSON. The model may not support structured output well. ' +
      'Try a different model or switch to Claude/GPT-4o.'
    );
  }

  guardOutput(parsed);
  return parsed;
}
