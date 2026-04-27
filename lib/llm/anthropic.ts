import Anthropic from '@anthropic-ai/sdk';
import { ResumeBuilderOutput } from '@/types';
import { buildSystemPrompt, buildUserMessage } from '@/lib/prompt';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

export async function callAnthropic(
  _combinedPrompt: string,          // kept for signature compatibility, not used
  apiKey: string,
  modelOverride?: string,
  resume?: string,
  jd?: string,
  companyName?: string
): Promise<ResumeBuilderOutput> {
  const client = new Anthropic({ apiKey });
  const model = modelOverride || DEFAULT_MODEL;

  // Use system/user separation — this prevents Anthropic's loop detector from
  // triggering on the JSON schema template embedded in a user message.
  const systemPrompt = buildSystemPrompt();
  const userMessage = resume && jd
    ? buildUserMessage(resume, jd, companyName)
    : _combinedPrompt; // fallback if called without structured args

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('looping content') || msg.includes('loop detection')) {
      throw new Error(
        'Claude flagged the output as repetitive. This usually means your resume has many ' +
        'similar bullet points across roles. Try reducing repeated phrasing, then generate again.'
      );
    }
    throw err;
  }

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'Response was cut off (resume too long). Try shortening your resume or switching to ' +
      'a model with a larger output limit.'
    );
  }

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Anthropic returned non-text content');
  }

  const raw = content.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  try {
    return JSON.parse(cleaned) as ResumeBuilderOutput;
  } catch {
    throw new Error(
      'Claude returned invalid JSON. This can happen with very long resumes — try again.'
    );
  }
}
