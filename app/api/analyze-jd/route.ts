import { NextRequest, NextResponse } from 'next/server';
import { callAnthropic } from '@/lib/llm/anthropic';
import { parseJdStructure } from '@/lib/jdParser';
import { validateAnalyzeJdRequest } from '@/lib/validation/analyzeJdRequest';
import { errorResponse, handleRouteError, missingApiKeyResponse } from '@/lib/api/routeErrors';
import { JDExtractionResult } from '@/types';
import { JD_EXTRACTION_MODEL } from '@/lib/constants';

export const maxDuration = 60; // Claude Haiku is fast

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const jsonBody = await req.json();
    const validation = validateAnalyzeJdRequest(jsonBody);
    if (!validation.success) {
      return errorResponse('VALIDATION_FAILED', validation.error);
    }

    const { jobDescription, companyName, anthropicKey, model } = validation.data;
    const apiKey = anthropicKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return missingApiKeyResponse();
    }

    // 1. Perform structural regex extraction
    const regexResult = parseJdStructure(jobDescription);

    // 2. Extract keywords with the fast extraction model unless the caller picked one.
    const modelId = model || JD_EXTRACTION_MODEL;
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
    // Same handling as /api/generate, so extraction failures reach Sentry too.
    return handleRouteError(err, 'analyze-jd');
  }
}
