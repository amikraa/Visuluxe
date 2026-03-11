create table if not exists public.edge_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  backend_job_id text not null,
  status text not null default 'pending',
  image_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists edge_generation_jobs_user_id_idx
  on public.edge_generation_jobs (user_id);

create unique index edge_generation_jobs_backend_job_id_idx
  on public.edge_generation_jobs (backend_job_id);

alter table public.edge_generation_jobs enable row level security;

create policy "Users can read their own jobs"
  on public.edge_generation_jobs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on public.edge_generation_jobs
  for insert
  with check (auth.uid() = user_id);