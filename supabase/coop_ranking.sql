-- Ranking global por modo: solo, dupla, trio e quarteto (partidas em grupo do Godot).
-- Migração sobre supabase/schema.sql. O que já existe vira solo (players = 1).
-- Em grupo, só o host envia o resultado do time: `name` é o host e `team` os nomes do time.

alter table public.scores add column if not exists players smallint not null default 1;
alter table public.scores drop constraint if exists scores_players_check;
alter table public.scores add constraint scores_players_check check (players between 1 and 4);
alter table public.scores add column if not exists team text;
alter table public.scores drop constraint if exists scores_team_check;
alter table public.scores add constraint scores_team_check check (team is null or char_length(team) between 1 and 64);

create index if not exists scores_season_map_players_score on public.scores (season, map, players, score desc);

-- Plausibilidade × jogadores (o time soma os pontos de todos); solo continua igual.
create or replace function public.scores_before_insert() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.scores
    where lower(name) = lower(new.name) and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Aguarde alguns segundos antes de enviar outra pontuação';
  end if;
  if new.score > (10000 + 2500 * new.wave * new.wave + 50 * new.wave * new.wave * new.wave) * new.players then
    raise exception 'Pontuação implausível para a wave';
  end if;
  if new.kills > (20 + 10 * new.wave + 3 * new.wave * new.wave) * new.players then
    raise exception 'Abates implausíveis para a wave';
  end if;
  if new.players = 1 then
    new.team := null;
  elsif new.team is null then
    raise exception 'Partida em grupo sem o time';
  end if;
  new.season := floor(extract(epoch from now()) / 1296000)::int;
  new.created_at := now();
  return new;
end $$;

-- Melhor resultado de cada nome (solo) ou time (grupo) por temporada, mapa e modo. A view muda
-- de colunas: precisa ser recriada.
drop view if exists public.leaderboard;
create view public.leaderboard as
  select distinct on (season, map, players, lower(coalesce(team, name)))
    season, map, players, name, team, score, wave, kills, created_at
  from public.scores
  order by season, map, players, lower(coalesce(team, name)), score desc, created_at asc;

grant select on public.leaderboard to anon;
