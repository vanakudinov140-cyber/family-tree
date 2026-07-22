# Person photos — private Storage setup

Ручная настройка фотографий родственников для family-tree.
**Не выполняйте эти шаги автоматически из CI/агента** — только вручную в Supabase Dashboard и SQL Editor.

Приложение **не** использует публичный bucket, `getPublicUrl`, `service_role` или base64 в PostgreSQL.

---

## 1. Создать private bucket `person-photos`

1. Откройте **Supabase Dashboard → Storage → New bucket**.
2. **Name:** `person-photos`
3. **Public bucket:** **выключено** (`Public = false`)
4. Сохраните bucket.

---

## 2. MIME и лимит размера

В настройках bucket `person-photos`:

| Параметр | Значение |
|----------|----------|
| Max file size | **4 MB** |
| Allowed MIME types | `image/webp`, `image/jpeg`, `image/png` |

Клиент дополнительно обрезает и оптимизирует изображение до квадрата ~1024×1024 (WebP, fallback JPEG) перед загрузкой. Оригинал в Storage не попадает.

---

## 3. Выполнить миграцию 005

1. Откройте файл `supabase/migrations/005_person_photos.sql`.
2. Скопируйте весь SQL в **SQL Editor**.
3. Выполните скрипт один раз (он идемпотентен для политик и CHECK).
4. Убедитесь, что ошибок нет.

Миграция добавляет:

- `people.photo_path` (относительный путь в bucket)
- `people.photo_updated_at`
- CHECK формата пути
- Storage RLS для `person-photos`
- RPC `set_person_photo`, `clear_person_photo`
- обновлённый `delete_person` с `deleted_photo_path`

Legacy-колонка `photo_url` (если была) **не удаляется** и не используется для новых фото.

---

## 4. Проверить Storage policies

В **Storage → Policies** (или SQL) должны быть только эти политики для bucket `person-photos` (имена точные):

| Policy | Role | Action |
|--------|------|--------|
| `person_photos_select_authenticated` | authenticated | SELECT |
| `person_photos_insert_admin` | authenticated + `is_admin()` | INSERT |
| `person_photos_delete_admin` | authenticated + `is_admin()` | DELETE |

**UPDATE** для файлов фотографий не создаётся (файлы immutable).

Anon не должен иметь доступ к `storage.objects` для этого bucket.

---

## 5. Загрузить первое фото

1. Войдите как **admin**.
2. Откройте профиль родственника.
3. Нажмите **Добавить фотографию**.
4. Выберите JPEG/PNG/WebP, обрежьте квадрат, сохраните.
5. В профиле и на heritage-карточке появится портрет.
6. В Storage появится файл вида:  
   `people/<person_uuid>/<file_uuid>.webp` (или `.jpg`).

---

## 6. Заменить фото

1. Admin → **Изменить фотографию**.
2. Порядок на клиенте: подготовка → upload нового UUID-файла → `set_person_photo` → best-effort удаление старого файла.
3. Старое фото **не** удаляется до успешного RPC.
4. В `people.photo_path` будет **новый** путь (не upsert того же объекта).

---

## 7. Удалить фото

1. Admin → **Удалить фотографию** → подтверждение.
2. Вызывается `clear_person_photo` (`photo_path = null`).
3. UI сразу показывает монограмму.
4. Файл в Storage удаляется best-effort; при сбое — предупреждение, данные человека корректны.

---

## 8. Проверить relative

1. Войдите как пользователь с ролью **relative** (не admin).
2. Фотографии видны (через signed URL).
3. Кнопок «Добавить / Изменить / Удалить фотографию» нет.
4. Прямой вызов `set_person_photo` / upload в Storage должен быть отклонён RLS/RPC.

---

## 9. Проверить гостя

1. Выйдите из аккаунта (anon).
2. В дереве и профиле — **монограмма**, не фото.
3. Signed URL не запрашивается.

---

## 10. Realtime во второй вкладке

1. Две вкладки, обе под admin (или relative для просмотра).
2. В первой загрузите/замените/удалите фото.
3. Во второй без перезагрузки обновится портрет / монограмма.
4. Focus, selected, viewMode, visualMode и zoom не должны сбрасываться.

---

## 11. Почему в БД `photo_path`, а не signed URL

- Signed URL **временный** и привязан к сессии/TTL.
- Путь стабилен и безопасен для RLS.
- Клиент сам получает signed URL только при активной сессии.
- В PostgreSQL не хранятся токены доступа к файлам.

---

## 12. Почему JSON backup не содержит изображения

Backup экспортирует метаданные (`photo_path`, `photo_updated_at`), но **не** бинарники и **не** signed URL.
Восстановление фотографий из JSON невозможно — только пути-метаданные. Сами файлы живут в Storage.

---

## 13. Найти orphan-файлы вручную

Orphan = файл в Storage, на который не ссылается ни один `people.photo_path`.

1. Storage → `person-photos` → папки `people/...`.
2. Сравните пути с:

```sql
select id, photo_path
from public.people
where photo_path is not null;
```

3. Файлы без совпадения в `photo_path` — кандидаты в orphan.

---

## 14. Безопасно удалить orphan через Dashboard

1. Убедитесь, что путь **не** указан ни у одного человека.
2. Storage → файл → Delete.
3. Не удаляйте файлы, которые ещё записаны в `photo_path`.

---

## 15. Откат миграции без удаления файлов

Откат схемы **не** обязан чистить Storage. Пример (осторожно, только если нужно):

```sql
-- Снять политики
drop policy if exists "person_photos_select_authenticated" on storage.objects;
drop policy if exists "person_photos_insert_admin" on storage.objects;
drop policy if exists "person_photos_delete_admin" on storage.objects;

drop function if exists public.set_person_photo(uuid, text);
drop function if exists public.clear_person_photo(uuid);
-- delete_person нужно вернуть к версии из миграции 003/004 вручную при полном откате

alter table public.people drop constraint if exists people_photo_path_format_check;
alter table public.people drop column if exists photo_path;
alter table public.people drop column if exists photo_updated_at;

drop function if exists public.is_valid_person_photo_path(text, uuid);
```

Файлы в bucket `person-photos` останутся — удалите их отдельно в Dashboard при необходимости.
После отката колонок заново примените актуальную версию `delete_person` из репозитория.
