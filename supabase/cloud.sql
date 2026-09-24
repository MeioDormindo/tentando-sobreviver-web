-- Save na nuvem do Tentando Sobreviver (uma linha por conta).
-- As contas usam o Supabase Auth: a senha fica só como hash bcrypt em auth.users (nunca em texto
-- nem recuperável). Cada jogador lê e grava apenas a própria linha (RLS com auth.uid()).

create table if not exists public.cloud_saves (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  updated_at timestamptz not null default now()
);

create or replace function public.cloud_saves_touch() returns trigger
language plpgsql as $$
begin
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists cloud_saves_touch on public.cloud_saves;
create trigger cloud_saves_touch before insert or update on public.cloud_saves
  for each row execute function public.cloud_saves_touch();

alter table public.cloud_saves enable row level security;
drop policy if exists "ler o proprio save" on public.cloud_saves;
create policy "ler o proprio save" on public.cloud_saves for select to authenticated using (auth.uid() = user_id);
drop policy if exists "criar o proprio save" on public.cloud_saves;
create policy "criar o proprio save" on public.cloud_saves for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "atualizar o proprio save" on public.cloud_saves;
create policy "atualizar o proprio save" on public.cloud_saves for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.cloud_saves from anon;
grant select, insert, update on public.cloud_saves to authenticated;

-- Nome de usuário: só o formato permitido pelo jogo (e-mail sintético usuario@jogador.tentandosobreviver.invalid).
create or replace function public.check_username() returns trigger
language plpgsql as $$
begin
  if new.email !~ '^[a-z0-9_]{3,16}@jogador\.tentandosobreviver\.invalid$' then
    raise exception 'Nome de usuário inválido';
  end if;
  return new;
end $$;

drop trigger if exists check_username on auth.users;
create trigger check_username before insert on auth.users
  for each row execute function public.check_username();
