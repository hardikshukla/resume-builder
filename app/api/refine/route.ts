import { NextRequest, NextResponse } from 'next/server';
import { RefineRequest, RefineResponse, ResumeData, CoverLetterData } from '@/types';
import { buildRefinePrompt, buildSystemPrompt } from '@/lib/prompt';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 120; // refine is faster than full generation

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

    const refinePrompt = buildRefinePrompt(
      { resume: currentOutput.resume, coverLetter: currentOutput.coverLetter },
      selectedRecommendations
    );

    let rawText: string;

    // ── Anthropic ──────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      if (!anthropicKey) {
        return NextResponse.json({ success: false, error: 'No Anthropic API key provided.' });
      }
      const model = anthropicModel || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
      const client = new Anthropic({ apiKey: anthropicKey });

      const response = await client.messages.create({
        model,
        max_tokens: 6000,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: refinePrompt }],
      });

      if (response.stop_reason === 'max_tokens') {
        return NextResponse.json({
          success: false,
          error: 'Refine response was cut off. Try selecting fewer recommendations at once.',
        });
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        return NextResponse.json({ success: false, error: 'Unexpected response from Anthropic.' });
      }
      rawText = content.text.trim();

    // ── OpenAI ─────────────────────────────────────────────────────────────────
    } else if (provider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json({ success: false, error: 'No OpenAI API key provided.' });
      }
      const model = openaiModel || process.env.OPENAI_MODEL || 'gpt-4o';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user',   content: refinePrompt },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ success: false, error: `OpenAI error: ${err}` });
      }
      const data = await res.json();
      rawText = data.choices?.[0]?.message?.content?.trim() ?? '';

    // ── Ollama ─────────────────────────────────────────────────────────────────
    } else {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const model   = ollamaModel || process.env.OLLAMA_MODEL || 'llama3';
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: refinePrompt, stream: false, format: 'json' }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ success: false, error: `Ollama error: ${err}` });
      }
      const data = await res.json() as { response: string };
      rawText = data.response.trim();
    }

    // ── Parse & validate output ────────────────────────────────────────────────
    const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let parsed: { resume: ResumeData; coverLetter: CoverLetterData };
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

    return NextResponse.json({ success: true, data: parsed });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg });
  }
}
