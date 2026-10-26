import { tool } from 'ai';
import { z } from 'zod';

const MAX_CHARS = 8_000;

/** Blocks requests to localhost / private networks (basic SSRF protection). */
function isSafeUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/, /\.local$/, /\.internal$/, /^127\./, /^10\./, /^0\./,
    /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^\[?::1\]?$/, /^\[?f[cd]/,
  ];
  return !privatePatterns.some((p) => p.test(host));
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/** Fetches a public web page and returns its readable text, truncated. */
export const readPage = tool({
  description:
    'Read the main text of a public web page. Use after webSearch when a snippet looks relevant ' +
    'and you need details, numbers or quotes.',
  inputSchema: z.object({ url: z.string().url().describe('Full http(s) URL to read') }),
  execute: async ({ url }) => {
    if (!isSafeUrl(url)) throw new Error('This URL is not allowed (only public http/https pages).');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ScoutResearchAgent/1.0 (+https://github.com)' },
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Page returned status ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html') && !type.includes('text/plain')) {
      throw new Error(`Unsupported content type: ${type || 'unknown'}`);
    }

    const raw = await res.text();
    const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? url;
    const text = type.includes('html') ? htmlToText(raw) : raw;
    return {
      url,
      title,
      text: text.slice(0, MAX_CHARS),
      truncated: text.length > MAX_CHARS,
    };
  },
});
