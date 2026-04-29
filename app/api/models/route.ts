import { NextRequest, NextResponse } from 'next/server';

export interface ModelEntry {
  id: string;
  name: string;
}

// ── In-memory response cache ──────────────────────────────────────────────────
// Keyed by `${provider}:${key_prefix_8_chars}` so different users don't share
// each other's model lists while still collapsing duplicate clicks.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { ts: number; models: ModelEntry[] }>();

function cacheKey(provider: string, apiKey = ''): string {
  return `${provider}:${apiKey.slice(0, 8)}`;
}

export async function POST(req: NextRequest) {

  try {
    const { provider, anthropicKey, openaiKey, ollamaUrl } =
      (await req.json()) as {
        provider: string;
        anthropicKey?: string;
        openaiKey?: string;
        ollamaUrl?: string;
      };

    // ── Cache lookup ─────────────────────────────────────────────────────────
    const ck = cacheKey(provider, anthropicKey ?? openaiKey ?? '');
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      return NextResponse.json({ models: hit.models, cached: true });
    }

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      if (!anthropicKey) {
        return NextResponse.json(
          { error: 'Anthropic API key required to fetch models.' },
          { status: 400 }
        );
      }

      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Anthropic ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        data: { id: string; display_name?: string }[];
      };

      const models: ModelEntry[] = data.data.map((m) => ({
        id: m.id,
        name: m.display_name ?? m.id,
      }));

      cache.set(ck, { ts: Date.now(), models });
      return NextResponse.json({ models });
    }

    // ── OpenAI ────────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key required to fetch models.' },
          { status: 400 }
        );
      }

      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openaiKey}` },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenAI ${res.status}: ${body}`);
      }

      const data = (await res.json()) as { data: { id: string }[] };

      // Keep only chat-capable models, sorted newest-first
      const CHAT_PREFIXES = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4'];
      const models: ModelEntry[] = data.data
        .filter((m) => CHAT_PREFIXES.some((p) => m.id.startsWith(p)))
        .sort((a, b) => b.id.localeCompare(a.id))
        .map((m) => ({ id: m.id, name: m.id }));

      cache.set(ck, { ts: Date.now(), models });
      return NextResponse.json({ models });
    }

    // ── Ollama ────────────────────────────────────────────────────────────────
    if (provider === 'ollama') {
      const baseUrl =
        ollamaUrl?.trim() ||
        process.env.OLLAMA_BASE_URL ||
        'http://localhost:11434';

      const res = await fetch(`${baseUrl}/api/tags`).catch((e) => {
        throw new Error(
          `Cannot reach Ollama at ${baseUrl}. Is it running? (${e.message})`
        );
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Ollama ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        models: { name: string; model: string }[];
      };

      const models: ModelEntry[] = (data.models ?? []).map((m) => ({
        id: m.name ?? m.model,
        name: m.name ?? m.model,
      }));

      if (models.length === 0) {
        return NextResponse.json(
          { error: 'Ollama is running but has no models installed. Run: ollama pull llama3' },
          { status: 404 }
        );
      }

      cache.set(ck, { ts: Date.now(), models });
      return NextResponse.json({ models });
    }

    return NextResponse.json(
      { error: `Unknown provider: ${provider}` },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch models';
    console.error('[API /models]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
