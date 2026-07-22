# Данные для массового импорта семьи

Этот каталог — место для подготовки JSON перед импортом через админский интерфейс.

## Файлы

- `family-import-template.json` — минимальный пример структуры формата.
- `family-import-draft.example.json` — безопасный вымышленный черновик для репозитория.
- `family-import-draft.json` — **локальный** черновик с реальными данными. В `.gitignore`, в GitHub не отправляется.
- `CURRENT_TEST_DATA_AUDIT.md` / `FAMILY_REVIEW.md` — приватные заметки (в `.gitignore`).

Не коммитьте реальные ФИО, даты, места рождения и заметки о родственниках.

## Как заполнять людей

Каждый человек — объект в массиве `people`:

- `key` — стабильный уникальный ключ (`person-ivan-…`). Он станет `external_key` в базе.
- `firstName` — обязательно.
- `lastName`, `middleName`, `maidenName` — только если известны; иначе `null`.
- `gender` — `male` | `female` | `other` | `unknown`.
- даты и годы — только подтверждённые; неизвестное оставляйте `null`.
- `dataStatus` — `confirmed` | `needs_review` | `test`.
- `notes` — служебные заметки для проверки.

Нельзя передавать `id`, `created_at`, `updated_at`, `photo_url`.

## Стабильные key

- Придумайте ключ один раз и не меняйте его.
- Повторный импорт с тем же `key` не создаст дубликат (режим `insert_only`).
- Не объединяйте людей только потому, что совпали ФИО.

## Родители

```json
{
  "key": "relationship-parent-child",
  "type": "parent",
  "person1Key": "parent-key",
  "person2Key": "child-key",
  "parentKind": "biological",
  "confidence": "confirmed",
  "notes": null
}
```

`person1Key` — родитель, `person2Key` — ребёнок.

`parentKind`:

- `biological` — биологический родитель
- `adoptive` — усыновитель
- `step` — отчим / мачеха
- `guardian` — опекун

## Супруги

```json
{
  "key": "relationship-spouse-pair",
  "type": "spouse",
  "person1Key": "first-key",
  "person2Key": "second-key",
  "spouseStatus": "current",
  "confidence": "confirmed",
  "notes": null
}
```

`spouseStatus`: `current` | `former` | `unknown`.

Несколько браков одного человека — несколько spouse-связей с разными партнёрами. Дети от разных союзов указываются отдельными parent-связями к нужным родителям.

## Усыновление

Связь `parent` с `parentKind: "adoptive"`. Биологического родителя, если он известен и должен быть в дереве, добавляйте отдельной `biological`-связью.

## Отчим / мачеха

Связь `parent` с `parentKind: "step"`. Отчим не должен автоматически считаться биологическим родителем.

## Неточные сведения

- у человека: `dataStatus: "needs_review"`
- у связи: `confidence: "probable"` или `"uncertain"`

Неизвестные даты оставляйте пустыми (`null`). Не придумывайте даты «для красоты».

## Почему нельзя связывать только по ФИО

Одинаковые имена встречаются часто. Импорт сопоставляет записи только по `external_key` (`key` в файле). Совпадение имени даёт предупреждение, но не объединяет людей.

---

## Абстрактный пример сложной схемы (без реальных персональных данных)

Ситуация:

1. У женщины есть дети от первого брака.
2. Затем она вступает во второй брак.
3. Рождается ребёнок от второго мужа.
4. У второго мужа уже есть дети от прошлого брака.
5. Один ребёнок усыновлён.
6. Один взрослый является отчимом (не биологический родитель).

Ключи (вымышленные роли, не реальные люди):

| key | роль |
| --- | --- |
| `woman-a` | женщина |
| `husband-first` | первый муж |
| `husband-second` | второй муж |
| `ex-of-second` | бывшая супруга второго мужа |
| `child-first-1` | ребёнок первого брака |
| `child-second-shared` | общий ребёнок второго брака |
| `child-second-prior` | ребёнок второго мужа от прошлого брака |
| `child-adopted` | усыновлённый ребёнок |
| `stepchild-of-second` | ребёнок, для которого второй муж — отчим |

Связи (фрагмент):

```json
{
  "relationships": [
    {
      "key": "rel-spouse-woman-first",
      "type": "spouse",
      "person1Key": "woman-a",
      "person2Key": "husband-first",
      "spouseStatus": "former",
      "confidence": "confirmed"
    },
    {
      "key": "rel-spouse-woman-second",
      "type": "spouse",
      "person1Key": "woman-a",
      "person2Key": "husband-second",
      "spouseStatus": "current",
      "confidence": "confirmed"
    },
    {
      "key": "rel-spouse-second-ex",
      "type": "spouse",
      "person1Key": "husband-second",
      "person2Key": "ex-of-second",
      "spouseStatus": "former",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-woman-child-first",
      "type": "parent",
      "person1Key": "woman-a",
      "person2Key": "child-first-1",
      "parentKind": "biological",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-first-child-first",
      "type": "parent",
      "person1Key": "husband-first",
      "person2Key": "child-first-1",
      "parentKind": "biological",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-woman-shared",
      "type": "parent",
      "person1Key": "woman-a",
      "person2Key": "child-second-shared",
      "parentKind": "biological",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-second-shared",
      "type": "parent",
      "person1Key": "husband-second",
      "person2Key": "child-second-shared",
      "parentKind": "biological",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-second-prior",
      "type": "parent",
      "person1Key": "husband-second",
      "person2Key": "child-second-prior",
      "parentKind": "biological",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-ex-prior",
      "type": "parent",
      "person1Key": "ex-of-second",
      "person2Key": "child-second-prior",
      "parentKind": "biological",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-adoptive",
      "type": "parent",
      "person1Key": "woman-a",
      "person2Key": "child-adopted",
      "parentKind": "adoptive",
      "confidence": "confirmed"
    },
    {
      "key": "rel-parent-step",
      "type": "parent",
      "person1Key": "husband-second",
      "person2Key": "stepchild-of-second",
      "parentKind": "step",
      "confidence": "confirmed"
    }
  ]
}
```

На этом этапе не импортируйте черновик с настоящими родственниками без отдельного подтверждения.
