## Что происходит на самом деле

Проверил код и логи — код кнопок и серверных функций чата **правильный**, RLS/грант на `chats` и `chat_messages` на месте, `attachSupabaseAuth` подключён в `src/start.ts`. Но в логах опубликованного сайта (`breezemp.lovable.app`) есть свежая ошибка:

```
[error] Server function info not found for
src_lib_chat_functions_ts--getOrCreateChat_createServerFn_handler
POST /_serverFn/…/getOrCreateChat → 500
```

Это классическая ситуация из документации TanStack Start: **на опубликованной версии worker не знает про серверную функцию** — билд, который сейчас работает на `breezemp.lovable.app`, был собран до последних правок чата, поэтому в его manifest этих RPC-стубов нет. Preview собран заново — там всё работает, но вы тестируете на публичном домене. В БД сейчас 0 чатов и 0 сообщений — ни одно сообщение фактически не долетело до сервера.

Плюс SSR-варнинги: `createServerFn().inputValidator()` устарел, `chat.functions.ts` использует старое API в 4 местах. Пока это только warning, но именно такие несостыковки между версиями API — частая причина «функция не попала в manifest» после апгрейдов.

## Что сделаю

1. **Мигрирую `src/lib/chat.functions.ts` на актуальное API**: 4 вызова `.inputValidator(...)` → `.validator(...)`. Логика и типы не меняются, только имя метода. Это убирает SSR-warnings и гарантирует, что все 6 функций (`getOrCreateChat`, `getOrCreateOrderChat`, `listChats`, `getChatThread`, `sendChatMessage`, `getUnreadChatCount`) корректно попадут в новый manifest.

2. **Проверю на preview** (invoke-server-function на `/messages/*` эндпоинты + просмотр логов), что все функции возвращают ожидаемые ошибки авторизации (401) — а не «Server function info not found».

3. **После проверки** — сообщу, что нужно **нажать «Publish»** (иначе публичный домен так и останется на старой сборке без чата). После публикации кнопки «Написать продавцу» на карточке товара, «Написать продавцу»/«Написать покупателю» в заказах и раздел «Сообщения» заработают на `breezemp.lovable.app`.

## Что НЕ трогаю

- UI компоненты чата (`messages.tsx`, `messages.$chatId.tsx`) — они уже работают в preview.
- RLS-политики и гранты на `chats`/`chat_messages` — уже правильные.
- Логика outbox с ретраями и toast-ошибками — уже есть.
- Бакет `chat-photos` и загрузка изображений — не трогаю.
