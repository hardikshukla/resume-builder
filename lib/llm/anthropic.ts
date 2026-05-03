import Anthropic from '@anthropic-ai/sdk';
import { ResumeBuilderOutput } from '@/types';
import { buildSystemPrompt } from '@/lib/prompt';
import { guardOutput } from '@/lib/llm/guard';
import { ResumeBuilderOutputSchema } from '@/lib/llm/schema';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

type SectionKey = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';

export async function callAnthropic(
  /**
   * `prompt` is used as the user message when resume/jd are not provided
   * (e.g. future callers that pre-build the full prompt). When resume + jd
   * are both present, the structured user content is built inline and prompt is ignored.
   */
  prompt: string,
  apiKey: string,
  modelOverride?: string,
  resume?: string,
  jd?: string,
  companyName?: string,
  sections: SectionKey[] | 'all' = 'all'
): Promise<ResumeBuilderOutput> {
  const client = new Anthropic({ apiKey });
  const model = modelOverride || DEFAULT_MODEL;

  // ── System prompt (cached — reused across all requests) ───────────────────
  const systemPrompt = buildSystemPrompt();

  // ── User message content ──────────────────────────────────────────────────
  // Structured as two blocks so Anthropic can cache the JD independently of
  // the candidate resume. Saves ~45% of input tokens on repeat runs.
  let jdText = `Please follow the 6-step ATS methodology and return the structured JSON output as specified.\n\nJOB DESCRIPTION:\n${jd}\n${companyName ? `COMPANY NAME: ${companyName}\n` : ''}`;
  if (sections !== 'all') {
    jdText += `\n\nGenerate ONLY the following sections in the "resume" object: ${sections.join(', ')}.\nLeave all other sections in the "resume" object unchanged (omit them entirely to save output tokens). You MUST STILL generate the full "gapAnalysis" and "coverLetter" objects.`;
  }

  // client.beta.messages supports cache_control on text blocks (prompt caching)
  const messagesContent: Anthropic.Beta.Messages.BetaContentBlockParam[] = resume && jd
    ? [
        {
          type: 'text',
          text: jdText,
          cache_control: { type: 'ephemeral' }
        } as Anthropic.Beta.Messages.BetaTextBlockParam,
        {
          type: 'text',
          text: `\nCANDIDATE RESUME:\n${resume}`
        } as Anthropic.Beta.Messages.BetaTextBlockParam
      ]
    : [{ type: 'text', text: prompt } as Anthropic.Beta.Messages.BetaTextBlockParam];

  // ── System prompt block with cache_control ────────────────────────────────
  const systemBlocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }
  ];

  // ── API call ──────────────────────────────────────────────────────────────
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,   // large resumes + cover letter need headroom
      system: systemBlocks,
      messages: [{ role: 'user', content: messagesContent }],
      betas: ['prompt-caching-2024-07-31'],
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
