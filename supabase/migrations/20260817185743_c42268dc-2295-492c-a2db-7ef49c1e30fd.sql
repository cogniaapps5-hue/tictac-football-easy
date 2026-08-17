update public.players set coach = 'Sebastián, Felipe y Christopher';

update public.attendance a set status = case when a.session_date = date '2026-08-06' then 'absent' else 'present' end
from public.players p where p.id = a.player_id and p.name like 'Marcos Alonso%';