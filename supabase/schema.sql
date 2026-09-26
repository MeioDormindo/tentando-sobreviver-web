-- Ranking global do Tentando Sobreviver (Supabase).
-- Temporadas de 15 dias: a temporada é calculada no servidor a partir da hora atual,
-- então virar a temporada "zera" o ranking sem apagar os dados antigos.
-- 15 dias = 1 296 000 segundos.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  season int not null default (floor(extract(epoch from now()) / 1296000))::int,
  map text not null check (map in ('terminal', 'map2', 'temple')),
  name text not null check (char_length(name) between 1 and 14),
  score int not null check (score between 0 and 5000000),
  wave int not null check (wave between 1 and 500),
  kills int not null check (kills between 0 and 100000),
  created_at timestamptz not null default now()
);

-- Migração: mapas aceitos (o Templo dos Mortos, "temple", entrou depois). Manter igual a
-- Leaderboard.MAPS no Godot.
alter table public.scores drop constraint if exists scores_map_check;
alter table public.scores add constraint scores_map_check check (map in ('terminal', 'map2', 'temple'));

create index if not exists scores_season_map_score on public.scores (season, map, score desc);

-- Antes de gravar: força a temporada e a hora do servidor e limita a 1 envio a cada 30s por nome.
create or replace function public.scores_before_insert() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.scores
    where lower(name) = lower(new.name) and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Aguarde alguns segundos antes de enviar outra pontuação';
  end if;
  -- Anti-trapaça: pontuação e abates impossíveis para a wave alcançada são recusados.
  if new.score > 10000 + 2500 * new.wave * new.wave + 50 * new.wave * new.wave * new.wave then
    raise exception 'Pontuação implausível para a wave';
  end if;
  if new.kills > 20 + 10 * new.wave + 3 * new.wave * new.wave then
    raise exception 'Abates implausíveis para a wave';
  end if;
  new.season := floor(extract(epoch from now()) / 1296000)::int;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists scores_before_insert on public.scores;
create trigger scores_before_insert before insert on public.scores
  for each row execute function public.scores_before_insert();

-- Segurança: qualquer um lê; qualquer um envia (só na temporada atual); ninguém altera nem apaga.
alter table public.scores enable row level security;
drop policy if exists "leitura publica" on public.scores;
create policy "leitura publica" on public.scores for select using (true);
drop policy if exists "envio na temporada atual" on public.scores;
create policy "envio na temporada atual" on public.scores for insert
  with check (season = floor(extract(epoch from now()) / 1296000)::int);

-- Melhor pontuação de cada nome por temporada e mapa (o que a tela de ranking mostra).
create or replace view public.leaderboard as
  select distinct on (season, map, lower(name)) season, map, name, score, wave, kills, created_at
  from public.scores
  order by season, map, lower(name), score desc, created_at asc;

grant select, insert on public.scores to anon;
grant select on public.leaderboard to anon;
