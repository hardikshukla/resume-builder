import { NextRequest, NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm';
import { GenerateRequest, LLMProvider } from '@/types';

export const maxDuration = 180; // match LLM timeout — large prompts can take 90-120s

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequest;

    if (!body.resume || !body.jobDescription) {
      return NextResponse.json(
        { success: false, error: 'Resume and job description are required.' },
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
