with orden as (
  select id, row_number() over (order by (case when name like 'Marcos Alonso Guerrero%' then 0 else 1 end), name) rn
  from public.players where archived_at is null
)
insert into public.payments (player_id, amount, concept, due_date, status, receipt_url, rejection_reason)
select id, 20000, 'Mensualidad Agosto 2026', date '2026-08-05',
  case when rn <= 25 then 'approved' when rn <= 37 then 'pending' when rn <= 42 then 'pending' else 'rejected' end,
  case when rn between 38 and 42 then 'https://placehold.co/600x800?text=Comprobante' when rn > 42 then 'https://placehold.co/600x800?text=Comprobante' else null end,
  case when rn > 42 then 'El comprobante no se ve legible. Por favor vuelve a subirlo 🙏' else null end
from orden;

insert into public.attendance (player_id, session_date, status)
select p.id, d.dia,
  case ((abs(hashtext(p.id::text || d.dia::text)) % 10)) when 0 then 'absent' when 1 then 'absent' when 2 then 'no_response' else 'present' end
from public.players p
cross join (values (date '2026-08-04'), (date '2026-08-06'), (date '2026-08-11'), (date '2026-08-13')) as d(dia)
where p.archived_at is null;