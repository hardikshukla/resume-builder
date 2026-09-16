import { NextRequest, NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm';
import { validateGenerateRequest } from '@/lib/validation/generateRequest';
import { errorResponse, handleRouteError, missingApiKeyResponse } from '@/lib/api/routeErrors';
import { verifyHallucinations } from '@/lib/validation/hallucinationGuard';
import { ResumeBuilderOutput } from '@/types';

export const maxDuration = 180; // match LLM timeout

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawJson = await req.json();
    const validation = validateGenerateRequest(rawJson);
    if (!validation.success) {
      return errorResponse('VALIDATION_FAILED', validation.error);
    }

    const body = validation.data;
    const apiKey = body.anthropicKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return missingApiKeyResponse();
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
    // Logs, reports real failures to Sentry, and maps the error to a status.
    return handleRouteError(err, 'generate');
  }
}
