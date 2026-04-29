import { NextRequest, NextResponse } from 'next/server';
import { RefineRequest, RefineResponse, ResumeData, CoverLetterData } from '@/types';
import { buildRefinePrompt } from '@/lib/prompt';
import { dispatchRaw } from '@/lib/llm/dispatch';
import { MAX_RESUME_CHARS } from '@/lib/constants';
import { guardOutput } from '@/lib/llm/guard';
import '@/lib/env'; // T7.5 — fail fast if required env vars are missing

export const maxDuration = 120;

export async function POST(req: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const body = (await req.json()) as RefineRequest;
    const {
      currentOutput,
      selectedRecommendations,
      provider,
      anthropicKey,
      openaiKey,
      anthropicModel,
      openaiModel,
      ollamaModel,
    } = body;

    if (!selectedRecommendations?.length) {
      return NextResponse.json({ success: false, error: 'No recommendations selected.' });
    }

    // Guard: serialised resume JSON can be large
    const resumeJson = JSON.stringify(currentOutput?.resume ?? '');
    if (resumeJson.length > MAX_RESUME_CHARS * 2) {
      return NextResponse.json({
        success: false,
        error: 'Resume data is too large to refine. Try regenerating with a shorter resume.',
      });
    }

    const refinePrompt = buildRefinePrompt(
      { resume: currentOutput.resume, coverLetter: currentOutput.coverLetter },
      selectedRecommendations
    );

    // ── Route to provider ─────────────────────────────────────────────────────
    let rawText: string;
    try {
      rawText = await dispatchRaw(refinePrompt, {
        provider,
        anthropicKey,
        openaiKey,
        anthropicModel,
        openaiModel,
        ollamaModel,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown provider error';
      return NextResponse.json({ success: false, error: msg });
    }

    // ── Parse & validate ──────────────────────────────────────────────────────
    const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let parsed: { resume: ResumeData; coverLetter: CoverLetterData; updatedMatchScore?: number };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Refine returned invalid JSON. Try again or select fewer recommendations.',
      });
    }

    if (!parsed.resume || !parsed.coverLetter) {
      return NextResponse.json({
        success: false,
        error: 'Refine response was missing required fields. Please try again.',
      });
    }

    // Re-use the placeholder guard for refine output too
    try {
      guardOutput(parsed as Parameters<typeof guardOutput>[0]);
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: e instanceof Error ? e.message : 'Refine output contained placeholder text.',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        resume:           parsed.resume,
        coverLetter:      parsed.coverLetter,
        updatedMatchScore:
          typeof parsed.updatedMatchScore === 'number'
            ? Math.min(100, Math.max(0, Math.round(parsed.updatedMatchScore)))
            : undefined,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg });
  }
}
