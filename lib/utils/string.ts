/**
 * string.ts — Shared string manipulation utilities.
 */

export function toCamelCase(str: string): string {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

export function toPascalCase(str: string): string {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

export function sanitizeFilename(raw: string): string {
  return raw.replace(/\.\./g, '').replace(/[/\\]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '').replace(/[^\w\s\-().+]/g, '')
    .replace(/\s+/g, '_').slice(0, 80) || 'document';
}

export function getTimestampStr() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const full = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return { date, full };
}
