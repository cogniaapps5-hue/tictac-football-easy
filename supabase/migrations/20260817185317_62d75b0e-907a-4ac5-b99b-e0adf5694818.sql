update public.players p
set parent_id = pr.id, parent_email = pr.email
from public.profiles pr
where pr.email = 'r.santibanez9593@gmail.com' and p.parent_id is null;

delete from public.players where name = 'TEMP BORRAR';

update public.profiles set full_name = 'Rocio Santibañez' where email = 'r.santibanez9593@gmail.com';

update public.profiles set must_change_password = false where must_change_password;