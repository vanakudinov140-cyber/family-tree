# Collaboration — test scenarios

Ручные проверки системы предложений и ролей.

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Relative видит «Предложить изменение» | Кнопка в профиле |
| 2 | Relative не видит «Редактировать» | Нет прямого редактирования |
| 3 | Relative отправляет person_update | Успех |
| 4 | Дерево сразу не меняется | Данные без изменений |
| 5 | Admin видит pending | В админ-панели |
| 6 | Admin принимает person_update | Данные обновлены |
| 7 | Realtime во 2-й вкладке | Изменение видно |
| 8 | Admin отклоняет с причиной | status=rejected |
| 9 | Relative видит причину | В «Мои предложения» |
| 10 | Admin запрашивает уточнение | needs_info |
| 11 | Relative отвечает | resubmit → pending |
| 12 | Relative отменяет pending | cancelled |
| 13 | Person create атомарно | Человек + связь |
| 14 | Ошибка связи | Нет одинокого человека |
| 15 | Parent cycle | Отклонено сервером |
| 16 | Duplicate spouse | Отклонено |
| 17 | Relative предлагает фото | proposals/ path |
| 18 | Другой relative не видит proposal-фото | RLS |
| 19 | Admin принимает фото | official photo_path |
| 20 | Proposal-файл очищается | best-effort |
| 21 | Editor редактирует напрямую | update_person OK |
| 22 | Editor загружает фото | set_person_photo OK |
| 23 | Editor не удаляет человека | RPC отказ |
| 24 | Editor не видит импорт | UI скрыт |
| 25 | Editor не управляет ролями | RPC отказ |
| 26 | Admin назначает editor | profiles.role=editor |
| 27 | Admin назначает второго admin | С подтверждением |
| 28 | Последний admin не понижается | Ошибка RPC |
| 29 | Admin не понижает себя | Ошибка RPC |
| 30 | Role update в 2-й вкладке | Realtime/focus refresh |
| 31 | Audit log при смене роли | Запись есть |
| 32 | Relative не видит auth emails чужих | Только свои предложения |
| 33 | URL/focus/zoom не сбрасываются | После approve |
| 34 | tsc и build | Успешно |
