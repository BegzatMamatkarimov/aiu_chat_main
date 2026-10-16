-- Назначает begzat.dev@gmail.com участником и admin во все группы без админа и без создателя
-- (демо-группы из supabase/seed.sql). Запускать ПОСЛЕ cleanup_test_data.sql.
-- Требуется, чтобы пользователь begzat.dev@gmail.com уже был зарегистрирован на сайте.
-- Запускается вручную в Supabase SQL Editor, повторный запуск безопасен.

insert into public.chat_members (chat_id, user_id, role)
select c.id, u.id, 'admin'
from public.chats c
cross join (select id from auth.users where email = 'begzat.dev@gmail.com') u
where c.type = 'group'
  and c.created_by is null
  and not exists (select 1 from public.chat_members m where m.chat_id = c.id and m.role = 'admin')
on conflict (chat_id, user_id) do update set role = 'admin';

-- Проверка: у каждой демо-группы должен быть admin.
select c.name, m.role
from public.chats c
left join public.chat_members m on m.chat_id = c.id and m.role = 'admin'
where c.type = 'group' and c.created_by is null
order by c.name;
