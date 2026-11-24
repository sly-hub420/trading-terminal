-- Tabela synchronizacji Trading Terminala (zastosowana w projekcie Supabase Lodówka+ 2026-11-24)
create table if not exists public.trading_docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists trading_docs_user_updated on public.trading_docs (user_id, updated_at);
alter table public.trading_docs enable row level security;
create policy "trading_docs_select_own" on public.trading_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "trading_docs_insert_own" on public.trading_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "trading_docs_update_own" on public.trading_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "trading_docs_delete_own" on public.trading_docs for delete to authenticated using ((select auth.uid()) = user_id);
