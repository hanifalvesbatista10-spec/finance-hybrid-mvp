-- Equity One V5.22 — exclusão individual de movimentos de metas

create or replace function public.equity_delete_goal_movement(
  p_movement_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_goal_id uuid;
  v_type text;
  v_amount numeric;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  select gm.goal_id, gm.movement_type, gm.amount
    into v_goal_id, v_type, v_amount
    from public.goal_movements gm
    join public.goals g on g.id = gm.goal_id
   where gm.id = p_movement_id
     and g.user_id = v_user
   for update of gm, g;

  if v_goal_id is null then
    raise exception 'Movimento da meta não encontrado';
  end if;

  delete from public.goal_movements
   where id = p_movement_id;

  if v_type = 'ADD' then
    update public.goals
       set current_amount = greatest(0, current_amount - v_amount)
     where id = v_goal_id
       and user_id = v_user;
  elsif v_type = 'WITHDRAW' then
    update public.goals
       set current_amount = current_amount + v_amount
     where id = v_goal_id
       and user_id = v_user;
  else
    raise exception 'Tipo de movimento inválido';
  end if;

  return jsonb_build_object(
    'ok', true,
    'movement_id', p_movement_id,
    'goal_id', v_goal_id,
    'reversed_type', v_type,
    'amount', v_amount
  );
end;
$$;

revoke all on function public.equity_delete_goal_movement(uuid) from public, anon;
grant execute on function public.equity_delete_goal_movement(uuid) to authenticated;
