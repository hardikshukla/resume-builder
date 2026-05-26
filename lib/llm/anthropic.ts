import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT } from '@/lib/prompt';
import { ResumeBuilderOutputSchema, RefineOutputSchema } from '@/lib/llm/schema';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022';

const PLACEHOLDER_RE = /\[PLACEHOLDER[:\s]/i;

export function guardOutput(output: unknown, path = 'root'): void {
  if (typeof output === 'string') {
    if (PLACEHOLDER_RE.test(output)) {
      throw new Error(
        `LLM returned placeholder text at "${path}". ` +
        `This is a prompt compliance issue — please try again.`
      );
    }
    return;
  }

  if (Array.isArray(output)) {
    output.forEach((item, i) => guardOutput(item, `${path}[${i}]`));
    return;
  }

  if (output !== null && typeof output === 'object') {
    for (const [key, value] of Object.entries(output)) {
      guardOutput(value, `${path}.${key}`);
    }
  }
}

export async function callAnthropic(
  apiKey: string,
  mode: 'generate' | 'refine',
  payload: {
    resume?: string;
    jobDescription?: string;
    companyName?: string;
    currentOutput?: unknown;
    selectedRecommendations?: string[];
    modelOverride?: string;
  }
): Promise<unknown> {
  const client = new Anthropic({ apiKey });
  const model = payload.modelOverride || DEFAULT_MODEL;

  let systemPrompt = '';
  let messagesContent: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];

  if (mode === 'generate') {
    if (!payload.resume || !payload.jobDescription) {
      throw new Error('Resume and Job Description are required for generate mode');
    }
    systemPrompt = SYSTEM_PROMPT;
    messagesContent = [
      {
        type: 'text',
        text: `CANDIDATE RESUME:\n${payload.resume}`,
        cache_control: { type: 'ephemeral' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
      {
        type: 'text',
        text: `JOB DESCRIPTION:\n${payload.jobDescription}\n${payload.companyName ? `COMPANY NAME: ${payload.companyName}\n` : ''}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam
    ];
  } else if (mode === 'refine') {
    if (!payload.currentOutput || !payload.selectedRecommendations) {
      throw new Error('currentOutput and selectedRecommendations are required for refine mode');
    }
    systemPrompt = REFINE_SYSTEM_PROMPT;
    const recList = payload.selectedRecommendations.map((r) => `- ${r}`).join('\n');
    messagesContent = [
      {
        type: 'text',
        text: `CURRENT RESUME AND COVER LETTER (JSON):\n${JSON.stringify(payload.currentOutput, null, 2)}`,
        cache_control: { type: 'ephemeral' }
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam,
      {
        type: 'text',
        text: `SELECTED IMPROVEMENTS TO APPLY:\n${recList}`
      } as unknown as Anthropic.Beta.Messages.BetaContentBlockParam
    ];
  }

  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } } as unknown as Anthropic.Beta.Messages.BetaTextBlockParam
  ];

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 8192,
      system: systemBlocks,
      messages: [{ role: 'user', content: messagesContent }],
      betas: ['prompt-caching-2024-07-31'],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('looping content') || msg.includes('loop detection')) {
      throw new Error(
        'Claude flagged the output as repetitive. Try reducing repeated phrasing, then generate again.'
      );
    }
    throw err;
  }

  // Log cache stats to server console
  if (response.usage) {
    const usage = response.usage as unknown as { cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
    console.log(
      `[Cache] write: ${usage.cache_creation_input_tokens ?? 0} | read: ${usage.cache_read_input_tokens ?? 0}`
    );
  }

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Response was cut off due to token limits. Try shortening input.');
  }

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Anthropic returned non-text content');
  }

  const raw = content.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Claude returned invalid JSON. Please try again.');
  }

  if (mode === 'generate') {
    const result = ResumeBuilderOutputSchema.safeParse(parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Claude response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } else {
    const result = RefineOutputSchema.safeParse(parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Claude refine response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  }

  guardOutput(parsed);
  return parsed;
}
