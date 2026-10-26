import { tool } from 'ai';
import { z } from 'zod';
import { withContext7, textOf } from '../mcp';

const MAX_CHARS = 8_000;
const TIMEOUT_MS = 15_000;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Picks the first Context7 match whose title actually matches the requested library.
 * Context7 never returns "not found": for an unknown name it returns its closest fuzzy match
 * (e.g. an unrelated library), so without this check Scout would quote the wrong docs.
 */
function pickLibrary(resolveText: string, library: string) {
  const wanted = normalize(library);
  const entries = resolveText.split(/\n-{3,}\n?/);
  for (const entry of entries) {
    const title = entry.match(/Title:\s*(.+)/)?.[1]?.trim();
    const id = entry.match(/Context7-compatible library ID:\s*(\S+)/)?.[1];
    if (!title || !id) continue;
    const got = normalize(title);
    if (got && (got.includes(wanted) || wanted.includes(got))) return { title, id };
  }
  return null;
}

/**
 * Looks up current documentation for a software library through the Context7 MCP server.
 * Wraps two of the server's tools (resolve-library-id, query-docs) behind one typed tool,
 * so the model can only reach what we allow.
 */
export const lookupDocs = tool({
  description:
    'Look up current official documentation and code examples for a software library or framework ' +
    '(e.g. Next.js, React, Tailwind CSS). Use for questions about APIs, configuration, versions or ' +
    'what changed. Not for news, prices or non-software topics.',
  inputSchema: z.object({
    library: z.string().min(1).max(80).describe("The library's official name, e.g. 'Next.js'"),
    topic: z.string().min(3).max(200).describe('One specific concept to look up, e.g. "use cache directive"'),
  }),
  execute: async ({ library, topic }, { abortSignal }) => {
    const options = { signal: abortSignal, timeout: TIMEOUT_MS };
    return withContext7(async (client) => {
      const resolved = textOf(
        await client.callTool({ name: 'resolve-library-id', arguments: { libraryName: library, query: topic }, options }),
      );
      const match = pickLibrary(resolved, library);
      if (!match) throw new Error(`No documentation for "${library}" in Context7. Try webSearch instead.`);

      const text = textOf(
        await client.callTool({ name: 'query-docs', arguments: { libraryId: match.id, query: topic }, options }),
      );
      return {
        library: match.title,
        libraryId: match.id,
        text: text.slice(0, MAX_CHARS),
        truncated: text.length > MAX_CHARS,
      };
    });
  },
});
