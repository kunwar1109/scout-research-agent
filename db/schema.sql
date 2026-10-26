-- Scout schema. Safe to re-run: `npm run db:setup`

-- One row per research session. The title is the first question asked.
create table if not exists chats (
  id         text primary key,
  title      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per UI message, stored in the AI SDK's UIMessage shape (parts as JSON),
-- so a saved chat renders exactly like a live one. seq keeps insertion order.
create table if not exists messages (
  id         text primary key,
  chat_id    text not null references chats(id) on delete cascade,
  seq        bigint generated always as identity,
  role       text not null,
  parts      jsonb not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_seq_idx on messages (chat_id, seq);

-- Reports the user approved via the saveReport tool.
create table if not exists reports (
  id         text primary key,
  chat_id    text not null references chats(id) on delete cascade,
  title      text not null,
  summary    text not null,
  markdown   text not null,
  created_at timestamptz not null default now()
);
create index if not exists reports_created_idx on reports (created_at desc);

-- Per-browser ownership (anonymous cookie id from proxy.ts). Chats without an owner are hidden.
alter table chats add column if not exists owner_id text;
create index if not exists chats_owner_updated_idx on chats (owner_id, updated_at desc);
