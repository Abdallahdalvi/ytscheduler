-- Add Reporting Tables
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade,
  report_type text not null check (report_type in ('WEEKLY', 'MONTHLY')),
  period_start date not null,
  period_end date not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  presentation_url text,
  csv_folder text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table channels add column if not exists auto_reporting boolean default false;
alter table channels add column if not exists reporting_type text default 'WEEKLY' check (reporting_type in ('WEEKLY', 'MONTHLY'));

create index if not exists idx_reports_channel_created on reports(channel_id, created_at desc);
