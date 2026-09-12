# 10 — Граница ViewModel ↔ форма ↔ Query

**Статус:** черновик

lanka намеренно не ставит ни форму, ни кеш server state: и то и другое у экосистемы
уже есть. Но у пользователя, который их приносит, нет ответа на вопрос «кто чем
владеет», и он изобретает его сам — каждый раз по-своему. Этот план не добавляет
ни `@lankajs/form`, ни `@lankajs/query`. Он добавляет то единственное, чего не хватает
для закрытого сценария: носитель ошибок с адресом поля, рабочий `onInit` у VM без
сценариев, и документ, который проводит границу.

## Как читать это

Настоящее время — намеренное состояние. Имена, которых пока нет в `api/*.api.md`,
законны здесь и нигде больше. Пути на код, который уже существует, ведут в источник.

---

## Спецификация

### 10.1 Принцип: два шва, не три

```
  форма
    │  шов #1: values ↓        ILankaFieldError[] ↑
    ▼
   VM   — единственный посредник; владеет оркестрацией и решает, куда идёт что
    │  шов #2: fetchQuery ↓    подписка на кеш ↑
    ▼
  Query
```

**Форма и Query не знакомы.** Прямой шов между ними запрещён — не по вкусу, а потому
что каждый из трёх известных багов экосистемы и есть такой шов: `defaultValues` из
`useQuery().data` (рефетч сбрасывает набранное), `setQueryData(formValues)` (input-shape
в кеше вместо domain-shape), `useMutation().isPending` рядом с `formState.isSubmitting`
(два флага одного факта).

### 10.2 Сценарии не протекают из VM

Сценарий — это шина между ViewModel'ами. Он **начинается в экшене VM и заканчивается в
обработчике VM**. Три запрета, каждый с причиной:

| Запрет | Что случится иначе |
| --- | --- |
| форма не подписывается на сценарий и не триггерит его | форма становится вторым VM без имени, линт её не видит, и «VM не импортирует VM» обходится через компонент |
| обработчик сценария не пишет в поля формы (`setError`, `reset`, `setValue`) | сценарий стирает то, что человек печатает. Обработчик пишет только `server`, `serverChangedAt`; форма узнаёт через баннер |
| событие кеша Query не становится сценарием, и сценарий не «есть» инвалидация | цикл: `trigger → invalidateQueries → refetch → событие кеша → trigger → …`. Мост в `onInit` **односторонний**: сценарий → `invalidateQueries`. Обратно — только `set(server*)`, никогда `trigger` |

Единственные, кто зовёт `trigger`, — экшены VM. Единственные, кто слышит, — обработчики VM.
Что VM сделает с услышанным — `set`, `setQueryData`, `invalidateQueries` — уже не сценарий.

### 10.3 Роль VM в четырёх конфигурациях

| | VM отдаёт | VM оставляет |
| --- | --- | --- |
| **L** только lanka | ничего | всё |
| **L+F** | поля, их валидацию, `touched`/`dirty`, `isSubmitting` | оркестрацию, `server`, сортировку ошибок, `defaultValues` |
| **L+Q** | хранение серверных данных между экранами | единственную точку чтения для компонента, оркестрацию |
| **L+F+Q** | и то и другое | посредничество |

Инвариантное ядро — не отдаётся ни в одной конфигурации: асинхронная валидация (экшен,
не gateway из резолвера — линт), сортировка ошибок по `kind`, сценарии, несерверное
состояние экрана.

Пороги — **L** по умолчанию; **+F** при field array, валидации на нажатие, зависимой
перевалидации, SSR-форме редактирования; **+Q** ровно при одном условии — один ресурс
читают два и более экрана одновременно. В Next / RRv7 / TanStack Start Q не нужен:
кеш у хоста (`skills/hosts` §5).

### 10.4 Носитель ошибок с адресом поля

Сегодня `LankaError.issues: readonly string[]`. Схемные ошибки склеивают путь и текст
(`describeIssue` в `core/src/validation/lanka-standard-validator/lankaStandardValidator.ts`),
серверные — `lankaMessageFromFieldErrors` берёт первое сообщение первого поля и в своём
же комментарии говорит: «showing them all is a form's job». Канон дошёл до границы формы
и остановился на ней.

```ts
// core/errors
export interface ILankaFieldError {
	/** Сегменты, не склейка: ["items", 0, "qty"]. RHF склеит точками, TanStack — скобками. */
	readonly path: readonly (string | number)[];
	readonly message: string;
	/** Машинный код поля, когда бэкенд его даёт. Для i18n. */
	readonly code?: string;
}

// ILankaErrorInit + LankaError
readonly fields?: readonly ILankaFieldError[];

// core/errors — глагол первым, работает над значением
export const readLankaFieldErrors = (error: unknown): readonly ILankaFieldError[];

// plugin-http — ILankaHttpErrorsConfig
extractFieldErrors?: (body: unknown) => readonly ILankaFieldError[] | undefined;
// рядом с lankaMessageFromFieldErrors, тот же формат { errors: { "items.1.qty": ["…"] } }
export const lankaFieldErrorsFromErrorMap = (body: unknown) => …;
```

`issues` не трогается — опубликованное имя не удаляется. Деление то же, что уже принято:
core носит, plugin-http парсит. **Нужно без единой форм-библиотеки:** в L это ложится в
`states.fieldErrors`, в L+F — в `setError`. Одно и то же значение, два потребителя.

### 10.5 `onInit` у VM без `scenarioHandlers`

`onInit` вызывается только из `initializeScenario()`
(`core/src/viewmodel/_internal/create-lanka-scenario-binder/createLankaScenarioBinder.ts`),
а `ALankaVM.build()` регистрирует VM в bootstrap только `if (hasBindings)`
(`core/src/viewmodel/_abstractions/lanka-vm/ALankaVM.ts`, `registerScenarioViewModel`).
Пробный тест «VM с `onInit` и без сценариев регистрируется» — **красный**:
`registerViewModel` вызван 0 раз. В `core/GUIDE.md` каветы нет.

Без этого L+Q не работает вовсе: подписка на кеш живёт в `onInit`, отписка — в `onReset`
(пара уже существует: `dispose()` → `resetScenario()` → `onReset()`).

### 10.6 Порядок этапа «после успеха» — правило, не рекомендация

```
1. trigger(scenario, { data })                  факт с данными
2. set({ server: data, serverChangedAt: null })  маркировка своей записи
3. setQueryData(key, data) | invalidateQueries   Q: кеш узнаёт
4. store.clear()                                 FQ-мастер: драфт потрачен
5. return { ok: true, data }                     форма жива, сама делает reset
6. навигация                                     последней
```

Шаг 2 до шага 3 — иначе собственный сабмит через подписку поднимет баннер «данные
изменились». Сравнение по `id + updatedAt`, не по ссылке: Query делает structural sharing.

### 10.7 Чего не строить

- `@lankajs/form`, `@lankajs/query` — второй ответ на вопрос, на который ответили.
- Хелпер ключей Query — конвенция `[gateway, method, ...args]` в одну строку GUIDE.
- Мост `onInit`-подписки публичным именем — восемь строк один раз на приложение.
  Порог: три независимых потребителя пишут одно и то же → `@lankajs/query-bridge` с
  peer-зависимостью только на `@tanstack/query-core`, без React.

---

## Порядок работ

### Фаза 0 — `onInit`/`onReset` без сценариев

Первой — у неё самый короткий красный тест, и без неё L+Q не существует.

**Результат:** VM регистрируется в bootstrap при `hasBindings || onInit || onReset`, во
всех трёх семействах (`ALankaVM`, `ALankaStatelessVM`, `createSharedStoreLankaVM`).

**Предусловия:** нет.

**Точки TDD:**

- пишется первым и падает: `createLankaVM({ onInit })` без `scenarioHandlers` →
  `lankaScenarioBootstrap.registerViewModel` вызван один раз. Уже прогнан: красный.
- пишется первым и падает: `bootstrap()` после такой VM вызывает `onInit` один раз;
  `dispose()` lazy-варианта вызывает `onReset` один раз.
- пишется первым и падает: VM без сценариев и без хуков **не** регистрируется —
  регистрация всех подряд превратила бы реестр в список всех VM приложения и
  замедлила bootstrap без причины.

**Приёмка:** `pnpm --filter lanka test`, затем `node scripts/check-api.mjs` — поверхность
не меняется, дифф должен быть пустым.

**Регрессия:** `LankaScenarioBootstrap.initializeAlreadyCreatedViewModels` перебирает
реестр; лишние VM в нём — лишние вызовы `initializeScenario`, который идемпотентен.
Тест «VM с одним `onInit` и без биндингов: `subscribe` ни одного сценария не вызван».

**Откат:** условие регистрации возвращается к `hasBindings`; поведение задокументировать
каветой в GUIDE — худший из двух исходов, но честный.

### Фаза 1 — `ILankaFieldError`, `fields`, `LankaValidationError`

**Результат:** тип в `core/src/errors/_interfaces/`, поле в `ILankaErrorInit` и
`LankaError`; `LankaValidationError` заполняет `fields` из `result.issues` — из тех же
данных, что сейчас склеивает в строки. Экспорт из `lanka/errors`.

**Предусловия:** нет (независима от фазы 0).

**Точки TDD:**

- пишется первым и падает: схема с ошибкой в `items[1].qty` → `error.fields[0].path`
  равен `["items", 1, "qty"]`, а `error.issues[0]` — прежняя строка `items.1.qty: …`.
  Что заставит упасть: `describeIssue` выбрасывает сегменты — их надо сохранить ДО склейки.
- пишется первым и падает: `issue.path` с объектным сегментом `{ key }` (Standard Schema
  допускает) → в `path` попадает `key`, не объект.
- пишется первым и падает: `new LankaError({ kind: "http", fields })` → `fields` та же
  ссылка; `errors` (геттер над `issues`) не изменился.

**Приёмка:** `pnpm --filter lanka test`, `node scripts/check-api.mjs --write` и **чтение
диффа** `api/lanka.api.md`: ровно два новых имени (`ILankaFieldError`,
`readLankaFieldErrors` если фаза 2 идёт вместе). `surface-architect` до коммита —
это фасад, и он только растёт.

**Регрессия:** `handleLankaApiError` и middleware `plugin-http` пересобирают `LankaError`
через `new LankaError({...})` — каждый такой конструктор обязан пронести `fields`. Тест в
фазе 3 это поймает; здесь — grep по `new LankaError(` в `core/` и `plugins/`.

**Откат:** поле необязательное; удаление — мажор, поэтому откатывается только ДО
публикации.

### Фаза 2 — `readLankaFieldErrors`

**Результат:** `readLankaFieldErrors(error: unknown): readonly ILankaFieldError[]` в
`core/errors`: `LankaError.is(error) ? error.fields ?? [] : []`. Глагол первым — работает
над значением, канон форм.

**Предусловия:** фаза 1.

**Точки TDD:**

- пишется первым и падает: не-`LankaError` → пустой массив, не исключение;
- пишется первым и падает: `LankaError` без `fields` → пустой массив (не `undefined`) —
  потребитель пишет `for … of` без проверки.

**Приёмка:** `pnpm --filter lanka test`; дифф `api/lanka.api.md`.

**Регрессия:** соблазн положить сюда сортировку по `kind` («поле / экран / тихо»).
**Не делать:** сортировка — политика приложения (какой `kind` куда) и документируется в
GUIDE, как `lankaFirstOf` публикует складывание экстракторов, а порядок оставляет
приложению.

**Откат:** как фаза 1.

### Фаза 3 — `extractFieldErrors` в `plugin-http`

**Результат:** поле в `ILankaHttpErrorsConfig`; `createErrorsMiddleware` вызывает его и
проносит результат в пересобранный `LankaError`; `lankaFieldErrorsFromErrorMap` для
формата `{ errors: { "a.b": ["…"] } }` — тот, что уже читает `lankaMessageFromFieldErrors`.
Ключ вида `items.1.qty` разбивается на сегменты, числовые — в `number`.

**Предусловия:** фаза 1.

**Точки TDD:**

- пишется первым и падает: `422` с телом `{ errors: { "items.1.qty": ["Осталось 2"] } }`
  через `createLankaFakeTransport` → `readLankaFieldErrors(error)` даёт
  `[{ path: ["items", 1, "qty"], message: "Осталось 2" }]`. Что заставит упасть: middleware
  пересобирает `LankaError` без `fields` — та самая регрессия фазы 1.
- пишется первым и падает: `extractFieldErrors` не задан → `fields` отсутствует, поведение
  прежнее байт в байт.
- пишется первым и падает: экстрактор бросил → ошибка запроса не подменяется ошибкой
  разбора (та же защита, что у `onRequestFailed` в `notify`).
- пишется первым и падает: `kind !== "http"` → экстрактор не вызывается.

**Приёмка:** `pnpm --filter @lankajs/plugin-http test`, дифф `api/plugin-http.api.md`.

**Регрессия:** плагин «knows nothing about a specific backend» (`plugins/http/SKILL.md`).
`lankaFieldErrorsFromErrorMap` — читатель ОДНОЙ формы, как его соседи, а не набор
эвристик. Если для второго бэкенда понадобилось условие внутри — это второй экстрактор.

**Откат:** конфигурацией — поле не задано.

### Фаза 4 — сцена в `core/_playground/`

**Результат:** одна сцена проводит `422` с путём в массив через оба потребителя: VM без
формы кладёт в `states.fieldErrors`; фейковая «форма» (объект с `setError(path, message)`)
получает те же ошибки через возврат экшена. Плюс сцена L+Q на фейковом «кеше» (`Map` с
`subscribe`): подписка в `onInit`, отписка в `onReset` через `dispose()`, и **тест на
отсутствие цикла** — обработчик сценария зовёт `invalidate`, событие кеша не зовёт `trigger`.

**Предусловия:** фазы 0–3.

**Точки TDD:**

- пишется первым и падает: два потребителя получают одинаковый массив из одного `LankaError`;
- пишется первым и падает: после `dispose()` событие кеша не меняет состояние;
- пишется первым и падает: обработчик сценария не трогает ключи полей — состояние `email`
  до и после `trigger` равно по `Object.is`. Это тест правила 10.2 в его проверяемой части.

**Приёмка:** `pnpm --filter lanka test`, `node scripts/check-structure.mjs` (6a — сцена
идёт через публичный путь).

**Регрессия:** сцена не тянет `@tanstack/*` и не тянет форм-библиотеку — `check:publishable`
и правило «core knows nothing of modules and plugins» это поймают.

**Откат:** удаление сцены; код фаз 0–3 от неё не зависит.

### Фаза 5 — документы

**Результат:**

- `core/GUIDE.md`, секция «Forms»: принцип двух швов, 10.2, L и L+F с кодом, порог,
  сортировка по `kind` (документ, не код), порядок 10.6, адаптеры RHF / TanStack Form /
  кастомная форма, цена перехода L → L+F, предусловие Standard Schema у резолверов;
  каветы: SSR — значения формы не в VM; `hydrateLankaVM` + `key={id}`.
- `core/GUIDE.md`, «ViewModels → Config reference»: `onInit`/`onReset` теперь с точной
  формулировкой, когда они срабатывают.
- `ARCHITECTURE.md`, «Кеш server state в SPA» (**Recommended**): дыра названа, форма A
  (QueryClient — синглтон, VM его потребитель), форма B (`allowedDirs`), форма C — не
  делать; таблица разведения `retry` / оптимистика / инвалидация / SSR; закрытые сценарии
  L+Q и L+F+Q.
- `tools/eslint/GUIDE.md`: пример `allowedDirs` для формы B — конфигурация правила, не его
  отключение.
- `skills/hosts/SKILL.md` §5: «кеш у хоста» — дополнить случаем без хоста, иначе отказ от
  кеша читается как отказ от Query.

**Предусловия:** фазы 0–4 — документ описывает то, что уже есть, иначе он план в одежде
документации.

**Точки TDD:** нет кода. Проверка — `node scripts/check-docs.mjs`, и `node
scripts/skills.mjs` перегенерирует `core/skills/lanka-*/reference.md` из GUIDE — руками
не трогать, `check:drift` откажет.

**Приёмка:** `pnpm run check:docs`, `pnpm run check:drift`, `pnpm run check:llms`.

**Регрессия:** секция «Forms» соблазняет описать RHF и TanStack подробно. Пишется ОДИН
раз — шов, не библиотека; всё, что специфично библиотеке, — три строки адаптера и ссылка.

**Откат:** документы откатываются свободно.

### Фаза 6 — канон

**Результат:** правило 10.2 и правило двух швов — в ОДНОМ месте владения. Кандидаты:
`ARCHITECTURE.md` (для приложений, **Recommended**) и потребительский skill
`core/skills/lanka-*/SKILL.md` (то, что загрузит агент потребителя — там это решающая
процедура, а не текст). Решает `canon-keeper`. В репозиторном `skills/` новое правило не
появляется: оно про приложения, не про этот репозиторий.

Отдельно проверить: запрещает ли `lankaBoundaries` / `lankaNoUpwardImports` импорт
`@Scenarios/*` из компонентов уже сейчас. Если да — 10.2 первая строка уже под гейтом, и
это надо записать. Если нет — это кандидат на правило, но **не в этом плане**: гейт с
новой семантикой — отдельное решение (`skills/gates`).

**Предусловия:** фаза 5.

**Приёмка:** `pnpm check` целиком — это последняя фаза перед коммитом серии.

**Откат:** канон откатывается свободно до релиза.

---

## Риски

| Риск | Что поймает |
| --- | --- |
| Регистрация всех VM в bootstrap замедлит старт | Третий тест фазы 0: без хуков и биндингов — не регистрируется |
| `fields` теряется в одном из пересборщиков `LankaError` | Тест фазы 3 через фейковый транспорт идёт по всему пути; grep `new LankaError(` |
| Сортировка по `kind` уедет в core как «удобство» | Регрессия фазы 2 названа явно; ревью `surface-architect` |
| Сцена L+Q притащит `@tanstack/*` в core | `check:publishable`; фейковый кеш — `Map` |
| Документ опишет библиотеки, а не шов | Регрессия фазы 5 |
| Односторонность моста нарушится у потребителя | Тест фазы 4 на отсутствие цикла — как образец; правило 10.2 в потребительском skill |
| SSR-кавета забудется | Отдельный пункт фазы 5; проверить, что `check:runtime` уже метит `viewmodel` как клиент |

## Урожай

- 10.1 и 10.2 — в `ARCHITECTURE.md` и потребительский skill core. Это единственные
  факты плана, которые живут дольше кода.
- Почему `path` — сегменты, а не строка (RHF и TanStack склеивают по-разному) —
  комментарием у `ILankaFieldError`.
- Почему сортировка по `kind` не в core — комментарием у `readLankaFieldErrors`.
- Почему `onInit` требовал биндингов и почему больше не требует — комментарием у
  условия регистрации в `ALankaVM.build()`, с указанием на пробный красный тест.
- Порядок 10.6 и причина «шаг 2 до шага 3» — в GUIDE «Forms».
- Порог для `@lankajs/query-bridge` — в `ARCHITECTURE.md`, чтобы следующий, кто захочет
  пакет, нашёл условие, а не спор.
- Дыра «в SPA кеша нет» — из «gap» в «намеренно пустой слот, вот чем заполнять» —
  `skills/hosts` §5.
