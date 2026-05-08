import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

export interface ModelEntry {
  id: string;
  name: string;
}

// ── In-memory response cache ──────────────────────────────────────────────────
// Keyed by `${provider}:${key_prefix_8_chars}` so different users don't share
// each other's model lists while still collapsing duplicate clicks.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { ts: number; models: ModelEntry[] }>();

function hashIdentity(value = ''): string {
  return createHash('sha256').update(value).digest('hex');
}

function cacheKey(provider: string, identity = ''): string {
  return `${provider}:${hashIdentity(identity)}`;
}

function getCachedModels(key: string): ModelEntry[] | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.models;
  }
  return null;
}

function setCachedModels(key: string, models: ModelEntry[]): void {
  cache.set(key, { ts: Date.now(), models });
}

// ── T6.1 — SSRF guard ─────────────────────────────────────────────────────────
// Blocks requests to internal/loopback/cloud-metadata addresses.
// Only http and https schemes are permitted.
const BLOCKED_PATTERNS = [
  // Loopback — 127.x.x.x and ::1
  /^127\.\d+\.\d+\.\d+$/,
  /^::1$/,
  // RFC 1918 private ranges
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  // Link-local / AWS instance metadata / GCP metadata
  /^169\.254\.\d+\.\d+$/,
  // Unique local IPv6
  /^f[cd][0-9a-f]{2}:/i,
  // All-zeros and broadcast
  /^0\.0\.0\.0$/,
];

function isBlockedIp(address: string): boolean {
  const normalized = address.toLowerCase();
  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const candidate = ipv4Mapped?.[1] ?? normalized;
  const version = net.isIP(candidate);

  if (version === 4) {
    const [a, b] = candidate.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  if (version === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
}

async function validateOllamaUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'ollamaUrl is not a valid URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: 'ollamaUrl must use http or https.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block numeric IPs that match internal ranges
  if (BLOCKED_PATTERNS.some((re) => re.test(hostname)) || isBlockedIp(hostname)) {
    return { ok: false, reason: 'ollamaUrl targets a blocked internal address.' };
  }

  // Block bare "localhost" keyword
  if (hostname === 'localhost') {
    // Allow localhost only if explicitly enabled by the server operator
    if (!process.env.ALLOW_LOCALHOST_OLLAMA) {
      return { ok: false, reason: 'ollamaUrl: localhost is not permitted from the server. Set ALLOW_LOCALHOST_OLLAMA=1 to enable.' };
    }
    return { ok: true, url: parsed };
  }

  if (!net.isIP(hostname)) {
    let addresses: { address: string; family: number }[];
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      return { ok: false, reason: 'ollamaUrl hostname could not be resolved.' };
    }

    if (addresses.some((entry) => isBlockedIp(entry.address))) {
      return { ok: false, reason: 'ollamaUrl resolves to a blocked internal address.' };
    }
  }

  return { ok: true, url: parsed };
}


export async function POST(req: NextRequest): Promise<NextResponse> {

  try {
    const { provider, anthropicKey, openaiKey, openrouterKey, ollamaUrl } =
      (await req.json()) as {
        provider: string;
        anthropicKey?: string;
        openaiKey?: string;
        openrouterKey?: string;
        ollamaUrl?: string;
      };

    // ── Anthropic ─────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      if (!anthropicKey) {
        return NextResponse.json(
          { error: 'Anthropic API key required to fetch models.' },
          { status: 400 }
        );
      }

      const ck = cacheKey(provider, anthropicKey);
      const hit = getCachedModels(ck);
      if (hit) {
        return NextResponse.json({ models: hit, cached: true });
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

      setCachedModels(ck, models);
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

      const ck = cacheKey(provider, openaiKey);
      const hit = getCachedModels(ck);
      if (hit) {
        return NextResponse.json({ models: hit, cached: true });
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

      setCachedModels(ck, models);
      return NextResponse.json({ models });
    }

    // ── Ollama ────────────────────────────────────────────────────────────────
    if (provider === 'ollama') {
      // User-supplied URL is SSRF-validated; the env-var default is operator-controlled.
      const rawUrl = ollamaUrl?.trim();
      let baseUrl: string;

      if (rawUrl) {
        const check = await validateOllamaUrl(rawUrl);
        if (!check.ok) {
          return NextResponse.json({ error: check.reason }, { status: 400 });
        }
        baseUrl = check.url.origin; // strip any path to avoid confusion
      } else {
        baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      }

      const ck = cacheKey(provider, baseUrl);
      const hit = getCachedModels(ck);
      if (hit) {
        return NextResponse.json({ models: hit, cached: true });
      }

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

      setCachedModels(ck, models);
      return NextResponse.json({ models });
    }

    // ── OpenRouter ────────────────────────────────────────────────────────────
    if (provider === 'openrouter') {
      if (!openrouterKey) {
        return NextResponse.json(
          { error: 'OpenRouter API key required to fetch models.' },
          { status: 400 }
        );
      }

      const ck = cacheKey(provider, openrouterKey);
      const hit = getCachedModels(ck);
      if (hit) {
        return NextResponse.json({ models: hit, cached: true });
      }

      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${openrouterKey}` },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        data: {
          id: string;
          name?: string;
          pricing?: { prompt?: string };
        }[];
      };

      const models: (ModelEntry & { isFree?: boolean })[] = data.data
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          isFree: m.pricing?.prompt === '0',
        }));

      setCachedModels(ck, models);
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
