import { tool } from 'ai';
import { z } from 'zod';

type TavilyResult = { title: string; url: string; content: string; score: number };

/**
 * Searches the live web through Tavily (free tier: tavily.com).
 * Returns short snippets the agent can use to decide which pages to read in full.
 */
export const webSearch = tool({
  description:
    'Search the web for up-to-date information. Returns titles, URLs and short snippets. ' +
    'Use specific queries of 2-8 words. Call several times with different angles for broad topics.',
  inputSchema: z.object({
    query: z.string().min(2).describe('The search query'),
    maxResults: z.number().int().min(1).max(8).default(5),
  }),
  execute: async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error('TAVILY_API_KEY is not set on the server.');

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Search failed with status ${res.status}`);

    const data = (await res.json()) as { results?: TavilyResult[] };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 400),
    }));
  },
});
