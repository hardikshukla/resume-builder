import { NextRequest, NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm';
import { GenerateRequest } from '@/types';
import { MAX_RESUME_CHARS, MAX_JD_CHARS } from '@/lib/constants';

export const maxDuration = 180; // match LLM timeout

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as GenerateRequest;

    if (body.mode === 'generate') {
      if (!body.resume || !body.jobDescription) {
        return NextResponse.json(
          { success: false, error: 'Resume and job description are required for generation.' },
          { status: 400 }
        );
      }

      if (body.resume.length > MAX_RESUME_CHARS) {
        return NextResponse.json(
          {
            success: false,
            error: `Resume is too long (${body.resume.length.toLocaleString()} chars). Please shorten to under ${MAX_RESUME_CHARS.toLocaleString()} characters.`,
          },
          { status: 400 }
        );
      }

      if (body.jobDescription.length > MAX_JD_CHARS) {
        return NextResponse.json(
          {
            success: false,
            error: `Job description is too long (${body.jobDescription.length.toLocaleString()} chars). Please shorten to under ${MAX_JD_CHARS.toLocaleString()} characters.`,
          },
          { status: 400 }
        );
      }
    } else if (body.mode === 'refine') {
      if (!body.currentOutput || !body.selectedRecommendations || body.selectedRecommendations.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Current output and selected recommendations are required for refinement.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid mode specified.' },
        { status: 400 }
      );
    }

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
