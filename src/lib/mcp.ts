import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';

const CONTEXT7_URL = process.env.CONTEXT7_MCP_URL || 'https://mcp.context7.com/mcp';

/**
 * Opens an MCP client to Context7, runs `fn`, and always closes the client.
 * Scoped to one tool call so no connection outlives a serverless invocation.
 */
export async function withContext7<T>(fn: (client: MCPClient) => Promise<T>): Promise<T> {
  // `type: 'http'` names the MCP transport (Streamable HTTP), not the URL scheme.
  // Encryption comes from the URL, so refuse anything that isn't https.
  if (new URL(CONTEXT7_URL).protocol !== 'https:') {
    throw new Error('MCP server URL must use https.');
  }
  const apiKey = process.env.CONTEXT7_API_KEY;
  const client = await createMCPClient({
    transport: {
      type: 'http',
      url: CONTEXT7_URL,
      ...(apiKey && { headers: { Authorization: `Bearer ${apiKey}` } }),
    },
  }).catch((error: unknown) => {
    console.error('mcp_connect_error', error);
    throw new Error('Could not reach the Context7 docs server. Use webSearch instead.');
  });
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

/** Joins the text items of an MCP tool result, throwing if the server reported an error. */
export function textOf(result: Awaited<ReturnType<MCPClient['callTool']>>) {
  // Older MCP servers may answer with a bare { toolResult } instead of content items.
  if (!Array.isArray(result.content)) return JSON.stringify(result.toolResult ?? '');
  const text = result.content
    .map((item) => (item.type === 'text' ? item.text : ''))
    .join('\n')
    .trim();
  if (result.isError) throw new Error(text || 'The MCP server returned an error.');
  return text;
}
