-- Multiplayer cooperativo do Tentando Sobreviver (Supabase): salas por código e sinalização
-- WebRTC. O jogo conecta os jogadores direto entre si (WebRTC); o servidor só guarda as
-- mensagens curtas da combinação (entrar, oferta, resposta, candidatos de rede) até todos se
-- conectarem.
--
-- Segurança: as tabelas não são lidas nem escritas direto pelo jogo (sem política para anon).
-- Tudo passa por funções (rpc): quem não sabe o código da sala não lista nem lê nada.
-- Limpeza: sala com mais de 3 horas e mensagem com mais de 30 minutos são apagadas a cada envio.
-- Limites: 60 salas novas por minuto (no total) e 300 mensagens por sala por minuto.

create table if not exists public.net_rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  host_name text not null check (char_length(host_name) between 1 and 14),
  created_at timestamptz not null default now()
);

create table if not exists public.net_signals (
  id bigint generated always as identity primary key,
  code text not null references public.net_rooms (code) on delete cascade,
  from_peer int not null check (from_peer >= 1),
  to_peer int not null check (to_peer >= 1),
  kind text not null check (kind in ('join', 'accept', 'reject', 'offer', 'answer', 'candidate', 'leave')),
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 8192),
  created_at timestamptz not null default now()
);

create index if not exists net_signals_inbox on public.net_signals (code, to_peer, id);
create index if not exists net_signals_age on public.net_signals (created_at);
create index if not exists net_rooms_age on public.net_rooms (created_at);

alter table public.net_rooms enable row level security;
alter table public.net_signals enable row level security;
revoke all on public.net_rooms from anon, authenticated;
revoke all on public.net_signals from anon, authenticated;

-- Cria a sala e devolve o código (5 letras/números sem os confusos: I, O, 0, 1).
create or replace function public.net_create_room(p_host_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if p_host_name is null or char_length(p_host_name) not between 1 and 14 then
    raise exception 'Nome inválido';
  end if;
  delete from net_rooms where created_at < now() - interval '3 hours';
  if (select count(*) from net_rooms where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Muitas salas novas agora, tente de novo em instantes';
  end if;
  loop
    new_code := '';
    for i in 1..5 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from net_rooms where code = new_code);
  end loop;
  insert into net_rooms (code, host_name) values (new_code, p_host_name);
  return new_code;
end $$;

-- Envia uma mensagem para um peer da sala (1 = host). Devolve o id da mensagem.
create or replace function public.net_send(p_code text, p_from int, p_to int, p_kind text, p_payload jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
begin
  if not exists (select 1 from net_rooms where code = upper(p_code)) then
    raise exception 'Sala não encontrada';
  end if;
  delete from net_signals where created_at < now() - interval '30 minutes';
  if (select count(*) from net_signals where code = upper(p_code) and created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Mensagens demais nesta sala, aguarde';
  end if;
  insert into net_signals (code, from_peer, to_peer, kind, payload)
    values (upper(p_code), p_from, p_to, p_kind, coalesce(p_payload, '{}'::jsonb))
    returning id into new_id;
  return new_id;
end $$;

-- Caixa de entrada de um peer: as mensagens para ele depois de `p_after` (em ordem).
create or replace function public.net_poll(p_code text, p_to int, p_after bigint)
returns table (id bigint, from_peer int, kind text, payload jsonb)
language sql security definer set search_path = public stable as $$
  select s.id, s.from_peer, s.kind, s.payload
  from net_signals s
  where s.code = upper(p_code) and s.to_peer = p_to and s.id > coalesce(p_after, 0)
  order by s.id
  limit 100;
$$;

-- A sala existe? (para "ENTRAR COM CÓDIGO" avisar na hora quando o código está errado)
create or replace function public.net_room_exists(p_code text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from net_rooms where code = upper(p_code));
$$;

revoke all on function public.net_create_room(text) from public;
revoke all on function public.net_send(text, int, int, text, jsonb) from public;
revoke all on function public.net_poll(text, int, bigint) from public;
revoke all on function public.net_room_exists(text) from public;
grant execute on function public.net_create_room(text) to anon, authenticated;
grant execute on function public.net_send(text, int, int, text, jsonb) to anon, authenticated;
grant execute on function public.net_poll(text, int, bigint) to anon, authenticated;
grant execute on function public.net_room_exists(text) to anon, authenticated;
