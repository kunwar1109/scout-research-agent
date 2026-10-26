import { createAgentUIStreamResponse, generateId } from 'ai';
import { researchAgent, type ScoutMessage } from '@/lib/agent';
import { MODEL_ID } from '@/lib/model';
import { rateLimit } from '@/lib/rate-limit';
import { canAccessChat, isValidChatId, saveMessage } from '@/lib/chat-store';
import { getOwnerId } from '@/lib/owner';

export const maxDuration = 60; // seconds (Vercel serverless limit)

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const limited = rateLimit(ip);
  if (!limited.ok) {
    return Response.json(
      { error: `Too many requests. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } },
    );
  }

  // useChat sends the chat id alongside the messages.
  const { id, messages }: { id: string; messages: ScoutMessage[] } = await req.json();
  if (!isValidChatId(id)) {
    return Response.json({ error: 'Invalid chat id.' }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'No messages sent.' }, { status: 400 });
  }

  // Per-browser ownership: proxy.ts guarantees the cookie, and a chat id from another browser is refused.
  const ownerId = await getOwnerId();
  if (!ownerId) {
    return Response.json({ error: 'Missing session cookie. Enable cookies and reload.' }, { status: 400 });
  }
  // If the database is down, nothing can be read or saved, so let the chat run unsaved.
  const allowed = await canAccessChat(id, ownerId).catch((error) => {
    console.error('access_check_error', error);
    return true;
  });
  if (!allowed) {
    return Response.json({ error: 'This chat belongs to another browser.' }, { status: 403 });
  }
  const persist = (message: ScoutMessage) => persistMessage(id, ownerId, message);

  // Save what just arrived: the user's question, or an assistant message carrying an approval response.
  await persist(messages[messages.length - 1]);

  // Keep the context window bounded: only the last 30 messages go to the model.
  // Older ones stay in the database because messages are upserted one by one, not replaced.
  const recent = messages.slice(-30);

  return createAgentUIStreamResponse({
    agent: researchAgent,
    uiMessages: recent,
    options: { chatId: id },
    abortSignal: req.signal,
    // Stop 5s before Vercel's 60s hard kill, so a stuck run ends with a visible error
    // (and a final save) instead of the connection just dying mid-"Thinking…".
    timeout: { totalMs: 55_000 },
    // Server-generated id for the new assistant message, so the saved row and the client agree.
    generateMessageId: generateId,
    // Save after every agent step: a refresh mid-run still shows the trail so far.
    // (Casts: the SDK can't infer RunMetadata from messageMetadata, so it types metadata as unknown.)
    onUIMessageStepEnd: ({ responseMessage }) => persist(responseMessage as ScoutMessage),
    // Final save also captures the finish metadata (tokens, model) and stopped runs.
    onEnd: ({ responseMessage }) => persist(responseMessage as ScoutMessage),
    messageMetadata: ({ part }) => {
      if (part.type === 'start') return { model: MODEL_ID };
      // After each step, report the model that actually answered (differs after a fallback).
      if (part.type === 'finish-step') return { model: part.response.modelId };
      // A timeout ends the stream as an "abort", which useChat treats like the user pressing
      // Stop (no error shown). Flag it on the message so the UI can say what happened.
      if (part.type === 'abort' && /timeout/i.test(part.reason ?? '')) return { timedOut: true };
      if (part.type === 'finish') {
        return { totalTokens: part.totalUsage.totalTokens, finishedAt: Date.now() };
      }
    },
    onError: (error) => {
      console.error('agent_error', error);
      return error instanceof Error ? error.message : 'The agent hit an unexpected error.';
    },
  });
}

/** Persistence is best-effort: a database hiccup is logged, never allowed to break a live answer. */
async function persistMessage(chatId: string, ownerId: string, message: ScoutMessage) {
  try {
    await saveMessage(chatId, ownerId, message);
  } catch (error) {
    console.error('persist_error', error);
  }
}
