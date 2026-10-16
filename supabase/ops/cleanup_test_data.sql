-- Очистка тестовых данных (пользователи e2e+%@example.com и всё, что с ними связано).
-- Запускать вручную в Supabase SQL Editor целиком, одним запуском (Run).
-- Пользователи с другими e-mail не затрагиваются, но удаляются ЧУЖИЕ группы, где
-- создатель или admin -- тестовый пользователь (вместе с сообщениями других людей).
--
-- ВНИМАНИЕ: удаление из storage.objects убирает записи; сами файлы Supabase физически
-- удаляет позже фоновой задачей. Операция необратима.

-- ===== 1. Предпросмотр (ничего не меняет) =====
select id, email, created_at
from auth.users
where email like 'e2e+%@example.com'
order by created_at;

select c.id, c.type, c.name, c.created_by,
       (select count(*) from public.chat_members m where m.chat_id = c.id) as members
from public.chats c
where c.type = 'group'
  and (
    c.created_by in (select id from auth.users where email like 'e2e+%@example.com')
    or exists (
      select 1 from public.chat_members m
      join auth.users u on u.id = m.user_id
      where m.chat_id = c.id and m.role = 'admin' and u.email like 'e2e+%@example.com'
    )
  )
order by c.created_at;

select count(*) as direct_chats_to_delete
from public.chats c
where c.type = 'direct'
  and (
    c.created_by in (select id from auth.users where email like 'e2e+%@example.com')
    or exists (
      select 1 from public.direct_pairs dp
      join auth.users u on u.id in (dp.user_a, dp.user_b)
      where dp.chat_id = c.id and u.email like 'e2e+%@example.com'
    )
  );

-- ===== 2. Удаление =====
-- Список чатов и пользователей запоминаем заранее: после удаления их уже не найти.
create temp table _del_users as
  select id from auth.users where email like 'e2e+%@example.com';

create temp table _del_chats as
  select c.id
  from public.chats c
  where c.created_by in (select id from _del_users)
     or exists (
       select 1 from public.chat_members m
       where m.chat_id = c.id and m.role = 'admin' and c.type = 'group'
         and m.user_id in (select id from _del_users)
     )
     or exists (
       select 1 from public.direct_pairs dp
       where dp.chat_id = c.id
         and (dp.user_a in (select id from _del_users) or dp.user_b in (select id from _del_users))
     );

-- 2.1 Файлы чатов (ДО удаления чатов): первая папка пути -- chat_id.
delete from storage.objects
where bucket_id = 'chat-media'
  and (storage.foldername(name))[1] in (select id::text from _del_chats);

-- 2.2 Аватарки (ДО удаления пользователей): первая папка пути -- user_id.
delete from storage.objects
where bucket_id = 'avatars'
  and (storage.foldername(name))[1] in (select id::text from _del_users);

-- 2.3 Чаты: сообщения, вложения, реакции, участники и direct_pairs удаляются каскадом.
delete from public.chats where id in (select id from _del_chats);

-- 2.4 Пользователи: каскадом уходят profiles, chat_members, reactions, direct_pairs.
-- Сообщения тестовых пользователей в чужих группах остаются с sender_id = null.
delete from auth.users where id in (select id from _del_users);

drop table _del_chats;
drop table _del_users;

-- ===== 3. Проверка: должно быть 0 =====
select count(*) as test_users_left from auth.users where email like 'e2e+%@example.com';
