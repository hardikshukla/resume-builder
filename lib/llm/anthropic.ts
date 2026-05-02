import Anthropic from '@anthropic-ai/sdk';
import { ResumeBuilderOutput } from '@/types';
import { buildSystemPrompt, buildUserMessage } from '@/lib/prompt';
import { guardOutput } from '@/lib/llm/guard';
import { ResumeBuilderOutputSchema } from '@/lib/llm/schema';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

export async function callAnthropic(
  /**
   * \`prompt\` is used as the user message when resume/jd are not provided
   * (e.g. future callers that pre-build the full prompt). When resume + jd
   * are both present, buildUserMessage() is used instead and prompt is ignored.
   */
  prompt: string,
  apiKey: string,
  modelOverride?: string,
  resume?: string,
  jd?: string,
  companyName?: string,
  sections: ('summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other')[] | 'all' = 'all'
): Promise<ResumeBuilderOutput> {
  const client = new Anthropic({ apiKey });
  const model = modelOverride || DEFAULT_MODEL;

  // System/user separation prevents Anthropic's loop detector from
  // triggering on the JSON schema template embedded in a user message.
  const systemPrompt = buildSystemPrompt();
  
  // Use Anthropic's structured content array to enable Prompt Caching.
  // By caching the system prompt and JD, we save ~45% of input tokens on repeat runs.
  let jdText = `Please follow the 6-step ATS methodology and return the structured JSON output as specified.\n\nJOB DESCRIPTION:\n${jd}\n${companyName ? `COMPANY NAME: ${companyName}\n` : ''}`;
  if (sections !== 'all') {
    jdText += `\n\nGenerate ONLY the following sections in the "resume" object: ${sections.join(', ')}.\nLeave all other sections in the "resume" object unchanged (omit them entirely to save output tokens). You MUST STILL generate the full "gapAnalysis" and "coverLetter" objects.`;
  }

  const messagesContent: any[] = resume && jd
    ? [
        {
          type: 'text',
          text: jdText,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: `\nCANDIDATE RESUME:\n${resume}`
        }
      ]
    : [{ type: 'text', text: prompt }];

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 16000,   // increased from 8192 — long resumes + cover letter need headroom
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: messagesContent }],
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

  let parsed: ResumeBuilderOutput;
  try {
    const raw_parsed = JSON.parse(cleaned);
    const result = ResumeBuilderOutputSchema.safeParse(raw_parsed);
    if (!result.success) {
      const field = result.error.issues[0]?.path.join('.') ?? 'unknown';
      const msg   = result.error.issues[0]?.message ?? 'schema mismatch';
      throw new Error(`Claude response failed validation at "${field}": ${msg}. Try again.`);
    }
    parsed = result.data;
  } catch (e) {
    if (e instanceof Error && e.message.includes('failed validation')) throw e;
    throw new Error('Claude returned invalid JSON. This can happen with very long resumes — try again.');
  }

  guardOutput(parsed);
  return parsed;
}

