-- TRILLIAN — Supabase Schema Migration
-- Run this in Supabase SQL Editor

-- Enable pgvector for semantic memory search
create extension if not exists vector;

-- ─── MEMORY TABLE ──────────────────────────────────────────────────────────
create table if not exists trillian_memory (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  content     text not null,
  embedding   vector(1536),              -- text-embedding-3-small dimensions
  category    text default 'general',    -- general | explicit | episodic | preference
  importance  int  default 5,            -- 1-10, higher = more important to retain
  source      text default 'conversation'
);

create index if not exists trillian_memory_embedding_idx
  on trillian_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists trillian_memory_category_idx
  on trillian_memory(category);

-- ─── CONVERSATIONS TABLE ───────────────────────────────────────────────────
create table if not exists trillian_conversations (
  id         bigserial primary key,
  created_at timestamptz default now(),
  session_id text not null,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  tokens     int  default 0
);

create index if not exists trillian_conv_session_idx
  on trillian_conversations(session_id, created_at desc);

-- ─── ALERTS TABLE ──────────────────────────────────────────────────────────
create table if not exists trillian_alerts (
  id             bigserial primary key,
  created_at     timestamptz default now(),
  fired_at       timestamptz default now(),
  acknowledged_at timestamptz,
  type           text not null,          -- pipeline_error | payment_failed | calendar_conflict | etc
  message        text not null,
  severity       text default 'info',    -- info | warning | critical
  channel        text default 'voice',   -- voice | sms | hud
  data           jsonb default '{}'
);

-- ─── ACTIONS TABLE (audit log) ─────────────────────────────────────────────
create table if not exists trillian_actions (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  session_id  text,
  tool_name   text not null,
  input       jsonb default '{}',
  output      jsonb default '{}',
  success     boolean default true,
  duration_ms int,
  error_msg   text
);

-- ─── SEMANTIC SEARCH FUNCTION ──────────────────────────────────────────────
-- Called by Trillian to find relevant memories for a query
create or replace function match_memories(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count     int   default 5
)
returns table (
  id         bigint,
  content    text,
  category   text,
  importance int,
  similarity float,
  created_at timestamptz
)
language plpgsql
as $$
begin
  return query
  select
    m.id,
    m.content,
    m.category,
    m.importance,
    1 - (m.embedding <=> query_embedding) as similarity,
    m.created_at
  from trillian_memory m
  where 1 - (m.embedding <=> query_embedding) > match_threshold
  order by similarity desc, m.importance desc
  limit match_count;
end;
$$;

-- ─── DAILY BRIEFING VIEW ───────────────────────────────────────────────────
create or replace view trillian_today as
select
  (select count(*) from trillian_conversations where created_at > now() - interval '24 hours') as conversations_today,
  (select count(*) from trillian_actions where created_at > now() - interval '24 hours') as actions_today,
  (select count(*) from trillian_alerts where fired_at > now() - interval '24 hours' and acknowledged_at is null) as unacknowledged_alerts,
  (select count(*) from trillian_memory) as total_memories;

select 'Trillian schema installed successfully' as result;
