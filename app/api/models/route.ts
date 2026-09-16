import { NextRequest, NextResponse } from 'next/server';
import { toApiErrorResponse } from '@/types/error';
import { ModelOption } from '@/types';

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
      // Surface the upstream status so the client can tell "your key is bad"
      // (401/403) from "Anthropic is busy or unreachable" (429/5xx). Collapsing
      // both into a 500 made every transient blip look like a rejected key.
      const isAuthFailure = res.status === 401 || res.status === 403;
      return NextResponse.json(
        {
          success: false,
          upstreamStatus: res.status,
          error: {
            type: isAuthFailure
              ? 'VALIDATION_FAILED'
              : res.status === 429
                ? 'RATE_LIMIT'
                : 'TIMEOUT',
            message: `Anthropic API returned status ${res.status}: ${body}`,
          },
        },
        { status: isAuthFailure ? 401 : 502 }
      );
    }

    const data = (await res.json()) as {
      data: { id: string; display_name?: string }[];
    };

    // The model picker only needs an id and a display name per Claude model.
    const models: ModelOption[] = data.data
      .filter((m) => m.id.startsWith('claude-'))
      .map((m) => ({ id: m.id, name: m.display_name || m.id }));

    return NextResponse.json({ success: true, models });
  } catch (err) {
    console.error('[API /models]', err);
    return NextResponse.json(toApiErrorResponse(err), { status: 500 });
  }
}
