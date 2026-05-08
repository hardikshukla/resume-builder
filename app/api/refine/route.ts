import { NextRequest, NextResponse } from 'next/server';
import { RefineResponse, ResumeData, CoverLetterData } from '@/types';
import { buildRefinePrompt } from '@/lib/prompt';
import { dispatchRaw } from '@/lib/llm/dispatch';
import { MAX_RESUME_CHARS } from '@/lib/constants';
import { guardOutput } from '@/lib/llm/guard';
import '@/lib/env'; // T7.5 — fail fast if required env vars are missing

import { z } from 'zod';

export const maxDuration = 120;

const RefineBodySchema = z.object({
  currentOutput: z.any(), // Further validated by JSON size guard
  selectedRecommendations: z.array(z.string().max(500)).min(1).max(20),
  provider: z.enum(['anthropic', 'openai', 'ollama', 'openrouter']),
  anthropicKey:    z.string().optional(),
  openaiKey:       z.string().optional(),
  openrouterKey:   z.string().optional(),
  anthropicModel:  z.string().optional(),
  openaiModel:     z.string().optional(),
  ollamaModel:     z.string().optional(),
  openrouterModel: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const rawBody = await req.json();
    const parsedBody = RefineBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request payload. Please ensure recommendations are selected.',
      }, { status: 400 });
    }

    const {
      currentOutput,
      selectedRecommendations,
      provider,
      anthropicKey,
      openaiKey,
      openrouterKey,
      anthropicModel,
      openaiModel,
      ollamaModel,
      openrouterModel,
    } = parsedBody.data;

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
        openrouterKey,
        anthropicModel,
        openaiModel,
        ollamaModel,
        openrouterModel,
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
