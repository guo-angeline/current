-- Run this once in the Supabase SQL editor before using the app.

-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Events table
create table if not exists live_events (
  id          bigserial primary key,
  title       text not null,
  category    text,
  lat         float8,
  lng         float8,
  base_popularity int,
  vibe_keywords   text[],
  image_url   text,
  start_time  timestamptz,
  end_time    timestamptz,
  source_url  text,
  created_at  timestamptz default now()
);

-- 3. Embeddings table (separate so we can join on demand)
create table if not exists event_embeddings (
  id        bigserial primary key,
  event_id  bigint references live_events(id) on delete cascade,
  embedding vector(768),
  created_at timestamptz default now()
);

create index if not exists event_embeddings_event_id_idx on event_embeddings(event_id);
create index if not exists event_embeddings_embedding_idx
  on event_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Vector similarity search function used by /api/chat and /api/ingest
create or replace function match_events(
  query_embedding vector(768),
  match_threshold float,
  match_count     int,
  search_time     timestamptz default now()
)
returns table (
  id            bigint,
  title         text,
  category      text,
  lat           float8,
  lng           float8,
  base_popularity int,
  vibe_keywords text[],
  image_url     text,
  start_time    timestamptz,
  end_time      timestamptz,
  source_url    text,
  similarity    float
)
language sql stable
as $$
  select
    le.id,
    le.title,
    le.category,
    le.lat,
    le.lng,
    le.base_popularity,
    le.vibe_keywords,
    le.image_url,
    le.start_time,
    le.end_time,
    le.source_url,
    1 - (ee.embedding <=> query_embedding) as similarity
  from live_events le
  join event_embeddings ee on le.id = ee.event_id
  where 1 - (ee.embedding <=> query_embedding) > match_threshold
    and le.end_time > search_time - interval '2 hours'
  order by ee.embedding <=> query_embedding
  limit match_count;
$$;
