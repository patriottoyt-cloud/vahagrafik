-- Выполнить один раз в Supabase → SQL Editor → New query → Run

create table if not exists app_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_kv enable row level security;

-- Приложение работает по анонимному ключу (без логина), поэтому даём
-- анонимусам полный доступ к этой единственной таблице. Ссылку на сайт
-- знают только свои — этого достаточно для внутреннего инструмента.
create policy "app_kv_public_access"
  on app_kv
  for all
  using (true)
  with check (true);
