create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  platform text not null default 'youtube',
  channel_name text not null,
  channel_external_id text,
  oauth_tokens_json jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade,
  type text not null check (type in ('video', 'thumbnail')),
  storage_path text not null,
  public_url text,
  file_size_bytes bigint,
  mime_type text,
  duration_sec integer,
  width integer,
  height integer,
  uploaded_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete set null,
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  thumbnail_url text,
  video_url text,
  media_video_id uuid references media(id) on delete set null,
  media_thumbnail_id uuid references media(id) on delete set null,
  status text not null check (status in ('draft', 'scheduled', 'published', 'failed')) default 'draft',
  visibility text not null default 'private' check (visibility in ('public', 'private', 'unlisted')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade,
  name text not null,
  description_template text not null default '',
  tags_template text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics_daily (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,
  date date not null,
  views bigint not null default 0,
  watch_time_minutes numeric(12,2) not null default 0,
  ctr numeric(6,3),
  subscriber_change integer not null default 0,
  impressions bigint not null default 0,
  created_at timestamptz not null default now(),
  unique(channel_id, post_id, date)
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  channel_id uuid references channels(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  status text not null default 'unread' check (status in ('unread', 'read')),
  delivery text not null default 'in_app' check (delivery in ('in_app', 'email')),
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_channel_status_scheduled on posts(channel_id, status, scheduled_at);
create index if not exists idx_media_channel_type_uploaded on media(channel_id, type, uploaded_at desc);
create index if not exists idx_analytics_channel_date on analytics_daily(channel_id, date desc);
create index if not exists idx_activity_channel_created on activity_logs(channel_id, created_at desc);
