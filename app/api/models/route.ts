import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { anthropicKey } = (await req.json()) as { anthropicKey?: string };
    const apiKey = anthropicKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Anthropic API key is required to fetch models.' },
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
      .map((m) => ({
        id: m.id,
        name: m.display_name || m.id,
      }));

    return NextResponse.json({ success: true, models });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch models.';
    console.error('[API /models]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
