'use client';

import Link from 'next/link';
import type { ChatSummary } from '@/lib/chat-store';

/** Left sidebar: past research sessions. `chats` is undefined while loading, null without a database. */
export function SessionList({ chats, activeId }: { chats: ChatSummary[] | null | undefined; activeId: string }) {
  return (
    <nav className="sessions" aria-label="Past research">
      {/* A full page load, not <Link>: after replaceState the router still holds the "/" page,
          so a soft navigation to "/" would keep the old chat's state. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="btn btn-primary new-session">New research</a>
      <h2 className="shelf-title">History</h2>
      {chats === null && <p className="shelf-hint">Add DATABASE_URL to keep past research across refreshes.</p>}
      {chats?.length === 0 && <p className="shelf-hint">Your past research will show up here.</p>}
      {chats && chats.length > 0 && (
        <ul>
          {chats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/c/${c.id}`}
                className="session"
                title={c.title}
                aria-current={c.id === activeId ? 'page' : undefined}
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
