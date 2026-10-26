'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithApprovalResponses, isToolUIPart } from 'ai';
import type { ScoutMessage } from '@/lib/agent';
import type { ChatSummary, SavedReport } from '@/lib/chat-store';
import { Markdown } from '@/components/Markdown';
import { TrailStep } from '@/components/TrailStep';
import { ReportShelf } from '@/components/ReportShelf';
import { SessionList } from '@/components/SessionList';

const EXAMPLES = [
  'Compare the free tiers of the top 3 vector databases right now',
  'What changed in the latest Next.js release, and is it worth upgrading?',
  'How much has India’s UPI transaction volume grown year over year? Show the math.',
];

export function Chat({ id: chatId, initialMessages }: { id: string; initialMessages?: ScoutMessage[] }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  // Bumped after every run so the sidebar and report shelf refetch from the database.
  const [refreshKey, setRefreshKey] = useState(0);

  const { messages, sendMessage, status, stop, error, regenerate, addToolApprovalResponse } =
    useChat<ScoutMessage>({
      id: chatId,
      messages: initialMessages,
      // After the user approves/denies a tool, resume the agent automatically.
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
      onFinish: () => setRefreshKey((k) => k + 1),
    });

  const busy = status === 'submitted' || status === 'streaming';

  const chats = useServerList<ChatSummary>('/api/chats', 'chats', refreshKey);
  const savedReports = useServerList<SavedReport>('/api/reports', 'reports', refreshKey);
  const sessionReports = useMemo<SavedReport[]>(
    () =>
      messages.flatMap((m) =>
        m.parts.flatMap((p) =>
          p.type === 'tool-saveReport' && p.state === 'output-available' ? [p.output] : [],
        ),
      ),
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    // First question of a new session: give it a reloadable URL without remounting the page.
    if (messages.length === 0) window.history.replaceState(null, '', `/c/${chatId}`);
    sendMessage({ text: trimmed });
    setInput('');
  }

  return (
    <div className="shell">
      <SessionList chats={chats} activeId={chatId} />

      <main className="main">
        <header className="topbar">
          <span className="brand">Scout</span>
          <span className="tagline">Searches, reads, checks the math, cites its sources.</span>
        </header>

        <div className="thread">
          {messages.length === 0 && (
            <section className="empty">
              <h1>What should Scout look into?</h1>
              <p>
                Give it a question that needs current information. You’ll see every search, page and
                calculation it makes on the way to an answer.
              </p>
              <div className="examples">
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="example" onClick={() => submit(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </section>
          )}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="msg-user">
                {m.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
              </div>
            ) : (
              <div key={m.id} className="msg-agent">
                {groupParts(m.parts).map((group, gi) =>
                  group.kind === 'tools' ? (
                    <ol key={gi} className="trail" aria-label="Agent steps">
                      {group.parts.map((p) => (
                        <TrailStep key={p.toolCallId} part={p} onApprove={addToolApprovalResponse} />
                      ))}
                    </ol>
                  ) : (
                    <Markdown key={gi}>{group.text}</Markdown>
                  ),
                )}
                {m.metadata?.totalTokens != null && (
                  <div className="meta">
                    {plural(countTools(m), 'action')}, {m.metadata.totalTokens.toLocaleString()} tokens, {m.metadata.model}
                  </div>
                )}
                {m.metadata?.timedOut && (
                  <div className="error-bar" role="alert">
                    <span>Scout ran out of time (55s limit). Try again, or ask a narrower question.</span>
                    {m.id === messages.at(-1)?.id && !busy && (
                      <button className="btn" onClick={() => regenerate()}>Retry</button>
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {status === 'submitted' && (
            <ol className="trail"><li className="step" data-state="running"><span className="step-label">Thinking…</span></li></ol>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer-wrap">
          {error && (
            <div className="error-bar" role="alert">
              <span>{error.message || 'Something went wrong.'}</span>
              <button className="btn" onClick={() => regenerate()}>Retry</button>
            </div>
          )}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            <textarea
              rows={1}
              value={input}
              placeholder="Ask a research question…"
              aria-label="Research question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
            />
            {busy ? (
              <button type="button" className="btn" onClick={stop}>Stop</button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={!input.trim()}>Ask</button>
            )}
          </form>
        </div>
      </main>

      {/* With a database, the shelf shows every saved report; without one, just this session's. */}
      <ReportShelf reports={savedReports ?? sessionReports} persisted={savedReports != null} />
    </div>
  );
}

/**
 * Fetches a list from one of our GET endpoints and refetches when refreshKey changes.
 * Returns undefined while loading and null when persistence is off.
 */
function useServerList<T>(url: string, key: string, refreshKey: number) {
  const [list, setList] = useState<T[] | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`${url} ${res.status}`))))
      .then((data) => !cancelled && setList(data[key]))
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [url, key, refreshKey]);
  return list;
}

type Part = ScoutMessage['parts'][number];
type ToolPart = Extract<Part, { type: `tool-${string}` }>;
type Group = { kind: 'tools'; parts: ToolPart[] } | { kind: 'text'; text: string };

/** Consecutive tool calls become one trail; text between them becomes prose. */
function groupParts(parts: Part[]): Group[] {
  const groups: Group[] = [];
  for (const p of parts) {
    const last = groups[groups.length - 1];
    if (isToolUIPart(p) && p.type.startsWith('tool-')) {
      const tp = p as ToolPart;
      if (last?.kind === 'tools') last.parts.push(tp);
      else groups.push({ kind: 'tools', parts: [tp] });
    } else if (p.type === 'text' && p.text.trim()) {
      if (last?.kind === 'text') last.text += p.text;
      else groups.push({ kind: 'text', text: p.text });
    }
  }
  return groups;
}

function countTools(m: ScoutMessage) {
  return m.parts.filter((p) => isToolUIPart(p)).length;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
