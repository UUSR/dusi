# Руководство по публикации скриптов в каталог Dusi

Это пошаговое руководство для модератора по добавлению скриптов из GitHub Issues в общий каталог.

## Структура каталога

```
dusi-script-catalog/
├── README.md                          # Описание каталога
├── index.json                         # Главный индекс всех скриптов
└── scripts/
    ├── notification-voice.json        # Скрипт 1
    ├── incoming-call-greeting.json    # Скрипт 2
    └── ...                            # Другие скрипты
```

## Пошаговый процесс публикации

### 1. Получить скрипт из Issue

Когда пользователь отправляет скрипт через приложение, создаётся GitHub Issue с содержимым:

```markdown
## Информация о скрипте

**Название:** Озвучка уведомления
**Описание:** Произносит голосовое сообщение при получении уведомления.
**Теги:** уведомления, голос, tts
**Версия:** 1.0
**Автор:** username

**SHA-256:** 0bb9a2b2ae9880ca8dc1c56b50a4a764c0966bef40e0eba8ef9855bb73c2e4d3

## JSON скрипта

\`\`\`json
{
  "id": "notif-voice-v1",
  "name": "Озвучка уведомления",
  "description": "Произносит голосовое сообщение при получении уведомления.",
  "tags": ["уведомления", "голос", "tts"],
  "events": [...],
  "actions": [...],
  "enabled": true,
  "createdAt": "2026-05-14T12:00:00.000Z",
  "updatedAt": "2026-05-14T12:00:00.000Z"
}
\`\`\`
```

### 2. Проверить корректность скрипта

Перед добавлением в каталог:

- [ ] **Валидность JSON** - скопировать JSON из Issue и проверить через https://jsonlint.com
- [ ] **Обязательные поля** - убедиться, что есть:
  - `id` - уникальный идентификатор (e.g., `notif-voice-v1`)
  - `name` - название скрипта
  - `description` - описание (минимум 20 символов)
  - `events` - минимум одно событие
  - `actions` - минимум одно действие
  - `tags` - теги (массив строк)
  - `createdAt`, `updatedAt` - временные метки

- [ ] **SHA-256 совпадает** - сравнить хэш из Issue с вычисленным:
  ```bash
  cat script.json | sha256sum
  ```

- [ ] **Отсутствие вредоносного кода** - проверить события и действия на корректность

### 3. Создать файл скрипта

1. **Скопировать JSON** из Issue
2. **Сохранить файл** в папке `scripts/` с именем `{id}.json`:
   ```bash
   # Например:
   scripts/notif-voice-v1.json
   scripts/incoming-call-greeting-v1.json
   ```
3. **Убедиться в форматировании** - скрипт должен быть валидный JSON

### 4. Обновить index.json

Добавить запись в массив `scripts` в файле `index.json`:

```json
{
  "id": "notif-voice-v1",
  "name": "Озвучка уведомления",
  "description": "Произносит голосовое сообщение при получении уведомления.",
  "tags": ["уведомления", "голос", "tts"],
  "version": 1,
  "filePath": "scripts/notif-voice-v1.json",
  "fileUrl": "https://raw.githubusercontent.com/UUSR/dusi-script-catalog/main/scripts/notif-voice-v1.json",
  "checksumSha256": "0bb9a2b2ae9880ca8dc1c56b50a4a764c0966bef40e0eba8ef9855bb73c2e4d3",
  "author": "username",
  "isPublic": true,
  "createdAt": "2026-05-14T12:00:00.000Z",
  "updatedAt": "2026-05-14T12:00:00.000Z",
  "minAppVersion": "0.0.2"
}
```

**Важные поля:**
- `id` - должен быть уникальным, без пробелов и спецсимволов
- `version` - номер версии (целое число, увеличить на 1 при обновлении)
- `fileUrl` - полный URL к файлу скрипта на GitHub (используется формат Raw URL)
- `checksumSha256` - хэш из Issue
- `author` - автор скрипта (из Issue)
- `isPublic` - всегда `true` для публичного каталога
- `minAppVersion` - минимальная версия приложения (текущая версия: `0.0.2`)

### 5. Обновить updatedAt в index.json

Изменить `updatedAt` в корне файла на текущую дату и время (ISO 8601 формат):

```json
{
  "schemaVersion": 1,
  "catalogId": "dusi-script-community",
  "title": "Dusi Community Catalog",
  "updatedAt": "2026-05-15T14:30:00.000Z",  // ← Обновить
  "scripts": [...]
}
```

### 6. Сделать коммит и пушить в GitHub

```bash
# Коммитить в основной репозиторий или создать Pull Request

git add scripts/notif-voice-v1.json index.json
git commit -m "feat: add notif-voice-v1 script from @username"
git push origin main
```

**Сообщение коммита должно содержать:**
- Тип: `feat` (новый скрипт), `fix` (обновление), `docs` (документация)
- Краткое описание добавленного скрипта
- Ссылка на Issue (например, `(#123)`)

Пример:
```
feat: add notification voice script from @username (#123)
```

### 7. Закрыть Issue

После публикации:
1. **Добавить комментарий** в Issue:
   ```markdown
   ✅ Скрипт успешно добавлен в каталог!
   
   **Ссылка на файл:** https://github.com/UUSR/dusi-script-catalog/blob/main/scripts/notif-voice-v1.json
   
   Скрипт будет доступен в приложении через 1-5 минут (после очистки кэша).
   ```

2. **Добавить лейбл** `published` (если создать)
3. **Закрыть Issue** с комментарием о успешной публикации

## Обновление существующего скрипта

Если пользователь отправляет обновление существующего скрипта:

1. **Увеличить версию** в `index.json`:
   ```json
   "version": 2,  // было 1
   "id": "notif-voice-v2",  // добавить суффикс версии
   ```

2. **Создать новый файл** `scripts/notif-voice-v2.json`

3. **Обновить запись** в `index.json` (или добавить новую)

4. **Удалить старую запись** из `index.json` (опционально, можно оставить архив)

## Проверка publikации

После пушинга в GitHub:

1. Проверить, что файл доступен по Raw URL:
   ```
   https://raw.githubusercontent.com/UUSR/dusi-script-catalog/main/scripts/notif-voice-v1.json
   ```

2. Проверить, что `index.json` доступен:
   ```
   https://raw.githubusercontent.com/UUSR/dusi-script-catalog/main/index.json
   ```

3. В приложении Dusi:
   - Открыть **Скрипты** → **Каталог скриптов**
   - Выполнить свайп вниз для обновления кэша
   - Проверить, что новый скрипт появился в списке

## Решение проблем

### Скрипт не появляется в приложении

- ✓ Проверить, что URL в `fileUrl` корректный и доступен
- ✓ Очистить кэш приложения (Settings → Apps → Dusi → Clear Cache)
- ✓ Перезагрузить приложение
- ✓ Проверить формат JSON в `index.json` (используйте https://jsonlint.com)

### Ошибка при импорте скрипта

- ✓ Убедиться, что JSON скрипта валиден
- ✓ Проверить, что все обязательные поля присутствуют
- ✓ Убедиться, что `createdAt`, `updatedAt` в ISO 8601 формате

### SHA-256 не совпадает

- ✓ Пересчитать хэш JSON:
  ```bash
  echo '{...}' | sha256sum
  ```
- ✓ Убедиться, что не добавлены пробелы в начало/конец файла
- ✓ Обновить `checksumSha256` в `index.json`

## Примеры

### Пример 1: Простой скрипт с одним событием и действием

```json
{
  "id": "hello-world-v1",
  "name": "Привет мир",
  "description": "Простой скрипт, который произносит 'Привет' при разблокировке.",
  "tags": ["приветствие", "голос"],
  "enabled": true,
  "events": [
    {
      "eventId": "screen_unlocked",
      "eventName": "Экран разблокирован",
      "enabled": true,
      "conditions": {}
    }
  ],
  "actions": [
    {
      "actionId": "speak_text",
      "actionName": "Произнести текст",
      "enabled": true,
      "parameters": {
        "text": "Привет!"
      }
    }
  ],
  "createdAt": "2026-05-14T12:00:00.000Z",
  "updatedAt": "2026-05-14T12:00:00.000Z"
}
```

### Пример 2: Запись в index.json

```json
{
  "id": "hello-world-v1",
  "name": "Привет мир",
  "description": "Простой скрипт, который произносит 'Привет' при разблокировке.",
  "tags": ["приветствие", "голос"],
  "version": 1,
  "filePath": "scripts/hello-world-v1.json",
  "fileUrl": "https://raw.githubusercontent.com/UUSR/dusi-script-catalog/main/scripts/hello-world-v1.json",
  "checksumSha256": "a1b2c3d4e5f6...",
  "author": "@johndoe",
  "isPublic": true,
  "createdAt": "2026-05-14T12:00:00.000Z",
  "updatedAt": "2026-05-14T12:00:00.000Z",
  "minAppVersion": "0.0.2"
}
```

## Автоматизация (опционально)

В будущем можно добавить GitHub Actions для:
- Автоматической валидации JSON при PR
- Проверки обязательных полей в Issue
- Генерации SHA-256 хэшей
- Автоматического обновления `updatedAt`

Пример workflow:
```yaml
name: Validate Script Submission
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate JSON
        run: |
          for f in scripts/*.json; do
            jq empty "$f" || exit 1
          done
```

---

**Вопросы?** Создайте Issue или обратитесь к разработчику каталога.
