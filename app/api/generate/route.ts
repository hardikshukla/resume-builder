import { NextRequest, NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm';
import { GenerateRequest, LLMProvider } from '@/types';
import { MAX_RESUME_CHARS, MAX_JD_CHARS } from '@/lib/constants';
import '@/lib/env'; // T7.5 — fail fast if required env vars are missing

export const maxDuration = 180; // match LLM timeout — large prompts can take 90-120s

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as GenerateRequest;

    if (!body.resume || !body.jobDescription) {
      return NextResponse.json(
        { success: false, error: 'Resume and job description are required.' },
        { status: 400 }
      );
    }

    if (body.resume.length > MAX_RESUME_CHARS) {
      return NextResponse.json(
        { success: false, error: `Resume is too long (${body.resume.length.toLocaleString()} chars). Please shorten to under ${MAX_RESUME_CHARS.toLocaleString()} characters.` },
        { status: 400 }
      );
    }

    if (body.jobDescription.length > MAX_JD_CHARS) {
      return NextResponse.json(
        { success: false, error: `Job description is too long (${body.jobDescription.length.toLocaleString()} chars). Please shorten to under ${MAX_JD_CHARS.toLocaleString()} characters.` },
        { status: 400 }
      );
    }

    if (!body.anthropicKey && !body.openaiKey) {

      return NextResponse.json(
        {
          success: false,
          error:
            'At least one API key is required (Anthropic or OpenAI). Ollama needs no key.',
        },
        { status: 400 }
      );
    }

    const validProviders: LLMProvider[] = ['anthropic', 'openai', 'ollama'];
    const provider: LLMProvider = validProviders.includes(body.provider)
      ? body.provider
      : ((process.env.DEFAULT_LLM_PROVIDER as LLMProvider) ?? 'anthropic');

    // SECURITY: keys used and immediately discarded — never logged or stored
    const llmResponse = await runLLM({
      resume: body.resume,
      jobDescription: body.jobDescription,
      companyName: body.companyName,
      provider,
      anthropicKey: body.anthropicKey,
      openaiKey: body.openaiKey,
      anthropicModel: body.anthropicModel,
      openaiModel: body.openaiModel,
      ollamaModel: body.ollamaModel,
      sections: body.sections,
    });

    return NextResponse.json({ success: true, data: llmResponse });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[API /generate] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
