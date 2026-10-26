import type { ScoutMessage } from './agent';
import { sql } from './db';

export type ChatSummary = { id: string; title: string; updatedAt: string };
export type SavedReport = {
  id: string;
  chatId?: string;
  title: string;
  summary: string;
  markdown: string;
  savedAt: string;
};

// Chat ids come from the client (URL and request body), so treat them as opaque tokens.
const CHAT_ID = /^[\w-]{1,64}$/;
export const isValidChatId = (id: unknown): id is string => typeof id === 'string' && CHAT_ID.test(id);

/** True when the chat doesn't exist yet (a new session) or belongs to this browser. */
export async function canAccessChat(chatId: string, ownerId: string) {
  if (!sql) return true;
  const [chat] = await sql`select owner_id from chats where id = ${chatId}`;
  return !chat || chat.owner_id === ownerId;
}

/**
 * Upsert one message. The same assistant message is saved after every agent step
 * as it grows, so writes must be idempotent: insert once, then overwrite its parts.
 */
export async function saveMessage(chatId: string, ownerId: string, message: ScoutMessage) {
  if (!sql) return;
  const metadata = message.metadata ? JSON.stringify(message.metadata) : null;
  await sql.transaction([
    sql`insert into chats (id, title, owner_id) values (${chatId}, ${titleOf(message)}, ${ownerId})
        on conflict (id) do update set updated_at = now() where chats.owner_id = excluded.owner_id`,
    // Only write into a chat this browser owns (defense in depth: the route checks too), and never
    // overwrite a message id that belongs to another chat.
    sql`insert into messages (id, chat_id, role, parts, metadata)
        select ${message.id}, ${chatId}, ${message.role}, ${JSON.stringify(message.parts)}::jsonb, ${metadata}::jsonb
        where exists (select 1 from chats where id = ${chatId} and owner_id = ${ownerId})
        on conflict (id) do update set parts = excluded.parts, metadata = excluded.metadata
        where messages.chat_id = excluded.chat_id`,
  ]);
}

/** Null when the chat belongs to another browser. */
export async function loadMessages(chatId: string, ownerId: string): Promise<ScoutMessage[] | null> {
  if (!sql) return [];
  if (!(await canAccessChat(chatId, ownerId))) return null;
  const rows = await sql`select id, role, parts, metadata from messages where chat_id = ${chatId} order by seq`;
  return rows.map(
    (r) => ({ id: r.id, role: r.role, parts: r.parts, ...(r.metadata && { metadata: r.metadata }) }) as ScoutMessage,
  );
}

/** Null means persistence is off (no DATABASE_URL), which the UI explains. */
export async function listChats(ownerId: string): Promise<ChatSummary[] | null> {
  if (!sql) return null;
  const rows = await sql`select id, title, updated_at from chats where owner_id = ${ownerId}
                         order by updated_at desc limit 50`;
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: new Date(r.updated_at).toISOString() }));
}

export async function saveReport(
  chatId: string,
  report: { title: string; summary: string; markdown: string },
): Promise<SavedReport> {
  const saved = { id: crypto.randomUUID(), chatId, ...report, savedAt: new Date().toISOString() };
  if (sql) {
    await sql`insert into reports (id, chat_id, title, summary, markdown, created_at)
              values (${saved.id}, ${chatId}, ${saved.title}, ${saved.summary}, ${saved.markdown}, ${saved.savedAt})`;
  }
  return saved;
}

export async function listReports(ownerId: string): Promise<SavedReport[] | null> {
  if (!sql) return null;
  const rows = await sql`select r.id, r.chat_id, r.title, r.summary, r.markdown, r.created_at
                         from reports r join chats c on c.id = r.chat_id
                         where c.owner_id = ${ownerId}
                         order by r.created_at desc limit 50`;
  return rows.map((r) => ({
    id: r.id,
    chatId: r.chat_id,
    title: r.title,
    summary: r.summary,
    markdown: r.markdown,
    savedAt: new Date(r.created_at).toISOString(),
  }));
}

function titleOf(message: ScoutMessage) {
  const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join(' ').trim();
  return (message.role === 'user' && text ? text : 'Untitled research').slice(0, 120);
}
