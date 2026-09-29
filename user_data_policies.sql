-- CODERA user_data security + one-row-per-user support
-- Run this once in Supabase SQL Editor.

alter table public.user_data enable row level security;

create index if not exists user_data_user_id_idx
  on public.user_data (user_id);

create unique index if not exists user_data_one_row_per_user
  on public.user_data (user_id);

drop policy if exists "Users can read their own CODERA data" on public.user_data;
drop policy if exists "Users can insert their own CODERA data" on public.user_data;
drop policy if exists "Users can update their own CODERA data" on public.user_data;
drop policy if exists "Users can delete their own CODERA data" on public.user_data;

create policy "Users can read their own CODERA data"
on public.user_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own CODERA data"
on public.user_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own CODERA data"
on public.user_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own CODERA data"
on public.user_data
for delete
to authenticated
using (auth.uid() = user_id);
