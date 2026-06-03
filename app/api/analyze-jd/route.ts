import { NextRequest, NextResponse } from 'next/server';
import { callAnthropic } from '@/lib/llm/anthropic';
import { parseJdStructure } from '@/lib/jdParser';
import { validateAnalyzeJdRequest } from '@/lib/validation/analyzeJdRequest';
import { toApiErrorResponse } from '@/types/error';
import { JDExtractionResult } from '@/types';

export const maxDuration = 60; // Claude Haiku is fast

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
    const jsonBody = await req.json();
    const validation = validateAnalyzeJdRequest(jsonBody);
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

    const { jobDescription, companyName, anthropicKey, model } = validation.data;
    const apiKey = anthropicKey || process.env.ANTHROPIC_API_KEY;
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

    // 1. Perform structural regex extraction
    const regexResult = parseJdStructure(jobDescription);

    // 2. Call Claude Haiku (prefer claude-haiku-4-5-20251001 or custom model override)
    const modelId = model || 'claude-haiku-4-5-20251001';
    const llmRaw = await callAnthropic(apiKey, 'analyze-jd', {
      jobDescription,
      companyName,
      modelOverride: modelId,
    });

    const llmResult = llmRaw as {
      seniority?: string;
      companyName?: string | null;
      mustHaveSkills: string[];
      niceToHaveSkills: string[];
      gapsDetected: string[];
    };

    // 3. Merge regex heuristics and LLM extraction
    const finalCompany = llmResult.companyName || companyName || regexResult.companyName || null;
    const finalSeniority = llmResult.seniority || regexResult.seniority || 'Mid / Unspecified';

    const data: JDExtractionResult = {
      seniority: finalSeniority,
      companyName: finalCompany,
      mustHaveSkills: llmResult.mustHaveSkills || [],
      niceToHaveSkills: llmResult.niceToHaveSkills || [],
      gapsDetected: llmResult.gapsDetected || [],
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[API /analyze-jd] Error:', err);
    const errorResponse = toApiErrorResponse(err);
    return NextResponse.json(
      errorResponse,
      { status: getStatus(errorResponse.error.type) }
    );
  }
}
