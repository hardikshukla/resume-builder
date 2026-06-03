import { NextRequest, NextResponse } from 'next/server';
import { toApiErrorResponse } from '@/types/error';
import { getModelCapabilities, MODEL_FALLBACKS } from '@/lib/constants';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { anthropicKey } = (await req.json()) as { anthropicKey?: string };
    const apiKey = anthropicKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            type: 'VALIDATION_FAILED',
            message: 'Anthropic API key is required to fetch models.',
          },
        },
        { status: 400 }
      );
    }

    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API returned status ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      data: { id: string; display_name?: string }[];
    };

    // Filter to models starting with 'claude-' and map them
    const models = data.data
      .filter((m) => m.id.startsWith('claude-'))
      .map((m) => {
        const caps = getModelCapabilities(m.id);
        const fallback = MODEL_FALLBACKS[m.id] || (m.id.includes('haiku') ? 'claude-haiku-4-5-20251001' : 'claude-3-5-sonnet-20241022');
        return {
          id: m.id,
          name: m.display_name || m.id,
          capabilities: caps,
          fallbackModelId: fallback !== m.id ? fallback : undefined,
        };
      });

    return NextResponse.json({ success: true, models });
  } catch (err) {
    console.error('[API /models]', err);
    return NextResponse.json(toApiErrorResponse(err), { status: 500 });
  }
}
