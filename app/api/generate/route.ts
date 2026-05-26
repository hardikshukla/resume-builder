import { NextRequest, NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm';
import { validateGenerateRequest } from '@/lib/validation/generateRequest';

export const maxDuration = 180; // match LLM timeout

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const validation = validateGenerateRequest(await req.json());
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const body = validation.data;
    const apiKey = body.anthropicKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Anthropic API key is required. Please set ANTHROPIC_API_KEY or supply it in the UI.',
        },
        { status: 400 }
      );
    }

    const llmResponse = await runLLM({
      resume: body.resume,
      jobDescription: body.jobDescription,
      companyName: body.companyName,
      anthropicKey: body.anthropicKey,
      model: body.model,
      mode: body.mode,
      currentOutput: body.currentOutput,
      selectedRecommendations: body.selectedRecommendations,
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
