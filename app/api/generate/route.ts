import { NextRequest, NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm';
import { validateGenerateRequest } from '@/lib/validation/generateRequest';
import { toApiErrorResponse } from '@/types/error';
import { verifyHallucinations } from '@/lib/validation/hallucinationGuard';
import { ResumeBuilderOutput } from '@/types';
import * as Sentry from '@sentry/nextjs';

export const maxDuration = 180; // match LLM timeout

function getStatus(type: string): number {
  switch (type) {
    case 'RATE_LIMIT': return 429;
    case 'TIMEOUT': return 504;
    case 'TOKEN_LIMIT': return 400;
    case 'VALIDATION_FAILED': return 400;
    case 'FATAL': return 500;
    default: return 500;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawJson = await req.json();
    const validation = validateGenerateRequest(rawJson);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_FAILED',
            message: validation.error,
          },
        },
        { status: 400 }
      );
    }

    const body = validation.data;
    const apiKey = body.anthropicKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_FAILED',
            message: 'Anthropic API key is required. Please set ANTHROPIC_API_KEY or supply it in the UI.',
          },
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
      jdKeywords: body.jdKeywords,
    });

    const outputData = llmResponse as ResumeBuilderOutput;

    // Run post-generation hallucination guard check
    const originalText = body.resume || '';
    const report = verifyHallucinations(originalText, outputData.resume);

    return NextResponse.json({
      success: true,
      data: {
        ...outputData,
        hallucinationReport: report,
      },
    });
  } catch (err) {
    console.error('[API /generate] Error:', err);
    
    // Capture to Sentry with scrubbed scope parameters
    Sentry.withScope((scope) => {
      scope.setExtra('apiError', err instanceof Error ? err.message : String(err));
      Sentry.captureException(err);
    });

    const errorResponse = toApiErrorResponse(err);
    return NextResponse.json(
      errorResponse,
      { status: getStatus(errorResponse.error.type) }
    );
  }
}
