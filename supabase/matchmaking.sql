-- ============================================================
-- RUYRA GAMES — Matchmaking (versión definitiva, sin race condition)
-- ============================================================
-- Pega TODO este archivo en: Supabase > SQL Editor > New query > Run
--
-- Cómo funciona (tu modelo mental, tal cual):
--   1) El 1er jugador pulsa JUGAR -> se crea la sala (1/3) y se une.
--   2) El 2º se une a la sala existente (2/3).
--   3) El 3º se une, la sala se llena (3/3) y pasa a 'playing'.
--   4) Si llega un 4º mientras esa partida juega -> crea sala nueva (1/3).
--
-- La clave: pg_advisory_xact_lock serializa a los jugadores del MISMO
-- juego+apuesta, así entran de uno en uno y siempre ven la sala del otro.
-- Es un lock a nivel de transacción (se libera al hacer commit), por eso
-- SÍ funciona con el pooler de Supabase (al revés que pg_advisory_lock).
-- ============================================================

drop function if exists find_or_join_room(numeric, numeric, int, text);

create or replace function find_or_join_room(
  p_bet         numeric,
  p_prize       numeric,
  p_max_players int,
  p_game_id     text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_balance numeric;
  v_room_id game_rooms.id%type;     -- se adapta a tu tipo de id (uuid o bigint)
  v_seed    game_rooms.seed%type;
  v_count   int;
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  -- 1) CERROJO por juego+apuesta. Los jugadores entran de uno en uno.
  --    Se libera automáticamente al terminar la transacción.
  perform pg_advisory_xact_lock(hashtext(p_game_id || ':' || p_bet::text)::bigint);

  -- 2) Idempotente: si este jugador YA está en una sala de este bucket,
  --    devuélvela sin cobrar de nuevo (evita doble cargo si se llama 2 veces,
  --    p.ej. React StrictMode en desarrollo).
  select r.id, r.seed
    into v_room_id, v_seed
  from game_rooms r
  join room_players rp on rp.room_id = r.id
  where rp.user_id = v_user
    and r.status in ('waiting', 'playing')
    and r.game_id = p_game_id
    and r.bet_amount = p_bet
    and r.created_at > now() - interval '10 minutes'
  order by r.created_at desc
  limit 1;

  if v_room_id is not null then
    return json_build_object('room_id', v_room_id, 'seed', v_seed);
  end if;

  -- 3) Comprueba saldo (bloquea la fila de la wallet para este jugador)
  select balance into v_balance from wallets where user_id = v_user for update;
  if v_balance is null or v_balance < p_bet then
    raise exception 'Saldo insuficiente';
  end if;

  -- 4) Busca una sala 'waiting' con sitio (mismo juego+apuesta, reciente)
  select r.id, r.seed
    into v_room_id, v_seed
  from game_rooms r
  where r.status = 'waiting'
    and r.game_id = p_game_id
    and r.bet_amount = p_bet
    and r.max_players = p_max_players
    and r.created_at > now() - interval '10 minutes'
    and (select count(*) from room_players rp where rp.room_id = r.id) < r.max_players
  order by r.created_at asc
  limit 1;

  -- 5) Si no hay sala libre, crea una nueva (status 'waiting', 1/3)
  if v_room_id is null then
    v_seed := floor(random() * 4294967295)::bigint;  -- semilla 32-bit (Mulberry32)
    insert into game_rooms (status, bet_amount, prize_amount, max_players, seed, game_id)
    values ('waiting', p_bet, p_prize, p_max_players, v_seed, p_game_id)
    returning id into v_room_id;
  end if;

  -- 6) Cobra la entrada y une al jugador
  update wallets
     set balance = balance - p_bet, updated_at = now()
   where user_id = v_user;

  insert into transactions (user_id, amount, type, room_id)
  values (v_user, -p_bet, 'game_entry', v_room_id);

  insert into room_players (room_id, user_id)
  values (v_room_id, v_user);

  -- 7) ¿Se ha llenado? -> arranca la partida (la sala se cierra a nuevas entradas)
  select count(*) into v_count from room_players where room_id = v_room_id;
  if v_count >= p_max_players then
    update game_rooms set status = 'playing' where id = v_room_id;
  end if;

  return json_build_object('room_id', v_room_id, 'seed', v_seed);
end;
$$;


-- ============================================================
-- cancel_room_join — devuelve el saldo si la sala sigue en 'waiting'
-- ============================================================
drop function if exists cancel_room_join(uuid);
drop function if exists cancel_room_join(bigint);

create or replace function cancel_room_join(p_room_id game_rooms.id%type)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_bet  numeric;
  v_left int;
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  -- Cerrojo sobre esta sala para no chocar con otros que entran/salen
  perform pg_advisory_xact_lock(hashtext('room:' || p_room_id::text)::bigint);

  -- Solo se puede cancelar si la sala todavía está esperando
  select bet_amount into v_bet
  from game_rooms
  where id = p_room_id and status = 'waiting';

  if v_bet is null then
    return;  -- la partida ya empezó (o no existe): no se reembolsa
  end if;

  -- ¿Estaba este jugador en la sala?
  delete from room_players
  where room_id = p_room_id and user_id = v_user;

  if not found then
    return;  -- no estaba, nada que reembolsar
  end if;

  -- Reembolso
  update wallets
     set balance = balance + v_bet, updated_at = now()
   where user_id = v_user;

  -- Apunte en el ledger (best-effort): si tienes un CHECK en type que no
  -- permite 'refund', no dejamos que bloquee el reembolso real de la wallet.
  begin
    insert into transactions (user_id, amount, type, room_id)
    values (v_user, v_bet, 'refund', p_room_id);
  exception when others then
    null;
  end;

  -- Si la sala se queda vacía, bórrala
  select count(*) into v_left from room_players where room_id = p_room_id;
  if v_left = 0 then
    delete from game_rooms where id = p_room_id;
  end if;
end;
$$;


-- ============================================================
-- Limpieza de salas zombie de pruebas anteriores (ejecútalo una vez)
-- ============================================================
delete from transactions where room_id in (
  select id from game_rooms where status = 'waiting' and created_at < now() - interval '10 minutes'
);
delete from room_players where room_id in (
  select id from game_rooms where status = 'waiting' and created_at < now() - interval '10 minutes'
);
delete from game_rooms where status = 'waiting' and created_at < now() - interval '10 minutes';
