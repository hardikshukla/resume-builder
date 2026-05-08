import { NextRequest, NextResponse } from 'next/server';

// Lightweight key validation — never triggers billing, only auth checks.
// Each provider has a cheap/free endpoint to verify credentials:
//   OpenRouter : GET /api/v1/auth/key  (returns account info)
//   Anthropic  : GET /v1/models        (returns model list)
//   OpenAI     : GET /v1/models        (returns model list)

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { provider, apiKey } = (await req.json()) as {
      provider: string;
      apiKey: string;
    };

    if (!provider || !apiKey || apiKey.trim().length < 8) {
      return NextResponse.json(
        { valid: false, error: 'Key is too short to be valid.' },
        { status: 400 }
      );
    }

    // ── OpenRouter ─────────────────────────────────────────────────────────
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });

      if (res.status === 401) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid key — please check you copied the full key from openrouter.ai/keys.',
        });
      }
      if (!res.ok) {
        return NextResponse.json({
          valid: false,
          error: `OpenRouter returned ${res.status}. Try again in a moment.`,
        });
      }

      const data = await res.json() as {
        data?: {
          label?: string;
          usage?: number;
          limit?: number | null;
          is_free_tier?: boolean;
          rate_limit?: { requests: number; interval: string };
        };
      };

      const info = data.data;
      const label     = info?.label ?? 'API Key';
      const usage     = info?.usage != null ? `$${info.usage.toFixed(4)} used` : null;
      const limit     = info?.limit != null ? `$${info.limit} limit` : 'no spending limit';
      const freeTier  = info?.is_free_tier ? ' · free tier' : '';
      const detail    = [label, usage, limit + freeTier].filter(Boolean).join(' · ');

      return NextResponse.json({ valid: true, detail });
    }

    // ── Anthropic ──────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
      });

      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid key — check your Anthropic Console at console.anthropic.com/settings/keys.',
        });
      }
      if (!res.ok) {
        return NextResponse.json({
          valid: false,
          error: `Anthropic returned ${res.status}. Try again in a moment.`,
        });
      }

      return NextResponse.json({ valid: true, detail: 'Anthropic key verified ✓' });
    }

    // ── OpenAI ─────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });

      if (res.status === 401) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid key — check your key at platform.openai.com/api-keys.',
        });
      }
      if (!res.ok) {
        return NextResponse.json({
          valid: false,
          error: `OpenAI returned ${res.status}. Try again in a moment.`,
        });
      }

      return NextResponse.json({ valid: true, detail: 'OpenAI key verified ✓' });
    }

    return NextResponse.json(
      { valid: false, error: `Validation not supported for provider: ${provider}` },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error during validation';
    return NextResponse.json({ valid: false, error: message }, { status: 500 });
  }
}
