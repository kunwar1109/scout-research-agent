import { tool } from 'ai';
import { z } from 'zod';
import { saveReport as storeReport } from '../chat-store';

/**
 * Saves a finished research report. This tool requires human approval
 * (configured in agent.ts), so the user reviews the report before it is saved.
 */
export const saveReport = tool({
  description:
    'Save a finished research report for the user. Only call this when the user asks for a report ' +
    'or a saved summary. The user must approve before it is saved.',
  inputSchema: z.object({
    title: z.string().max(120),
    summary: z.string().max(300).describe('One or two sentence summary'),
    markdown: z.string().describe('The full report in Markdown, with a Sources section of URLs'),
  }),
  // Tool context: server-side values the tool needs but the model never sees.
  // agent.ts fills it per request from the chat id.
  contextSchema: z.object({ chatId: z.string() }),
  execute: async (report, { context }) => storeReport(context.chatId, report),
});
