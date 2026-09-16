/**
 * contact.ts — the candidate's contact line, shared by the preview, both Word
 * exports and the plain-text resume sent back to Claude.
 */
import { ContactInfo } from '@/types';

/** "https://www.linkedin.com/in/jane/" -> "linkedin.com/in/jane" */
export function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/**
 * The non-empty contact fields in display order: email, phone, LinkedIn,
 * GitHub, location. With `shortenUrls`, profile links are shown without their
 * protocol, "www." or trailing slash — the form used on the resume itself.
 */
export function contactParts(
  contact: ContactInfo | undefined,
  { shortenUrls = false }: { shortenUrls?: boolean } = {}
): string[] {
  if (!contact) return [];
  const link = (url: string | null) => (url && shortenUrls ? shortenUrl(url) : url);
  return [contact.email, contact.phone, link(contact.linkedin), link(contact.github), contact.location]
    .filter((part): part is string => Boolean(part));
}
