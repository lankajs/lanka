# 14 — Независимость от фреймворка: порт, полка привязок, хосты

**Статус:** на утверждении. Ни одна фаза не начата.

Ядро перестаёт знать о React. `lanka/viewmodel` публикует порт чтения —
`getState`/`subscribe` — и ничего фреймворк-специфичного; привязки к React, Vue,
Svelte, Solid и Angular живут на полке `modules/bindings/` и держатся одной
conformance-сюитой; мета-фреймворки (Next, Nuxt, SvelteKit, SolidStart, Angular
SSR) остаются ХОСТАМИ — раздел в GUIDE, рецепт сборки, плейграунд, ни одного
пакета. Ваниль и node получают по плейграунду и ни одной привязки.

## Как читать

Настоящее время описывает ЦЕЛЕВОЕ состояние; имена, которых ещё нет
(`ILankaReadableVM`, `useLankaVM`, `modules/bindings/`), законны здесь и больше
нигде. Фаза выражает зависимость, не объём: «14.3» значит «не начинается до
того, как легла 14.2». Каждая подфаза заканчивается зелёным `pnpm check` и
коммитом; критерий перехода записан в конце каждой. Размер даётся в файлах,
посчитанных аудитом, а не в днях — там, где замера нет, так и написано.

## Что строится

Сегодня ViewModel — это React-хук: `createLankaVM` возвращает
`UseBoundStore<StoreApi<…>>`, экран пишет `const s = useTodoVM()`. Потребитель
на Vue не может этого использовать не потому, что внутри `useSyncExternalStore`,
а потому что публичная ФОРМА — хук. Импорт — один файл; контракт — вся
поверхность `lanka/viewmodel`.

Целевая форма — три слоя с одним швом между каждыми двумя:

| Слой     | Где                                             | Что знает                                                      |
| -------- | ----------------------------------------------- | -------------------------------------------------------------- |
| стор     | `lanka/viewmodel`                               | состояние, actions, сценарии, lifecycle; ни одного хука        |
| привязка | `modules/bindings/<fw>`                         | как ОДИН фреймворк подписывается на стор; порт и больше ничего |
| хост     | `@lankajs/host` + GUIDE + `_playgrounds/<host>` | где живёт запрос и как данные становятся первым состоянием     |

Фабрики — `createLankaVM`, `ALankaVM`, `createLazyLankaVM`, stateless,
shared-store — **остаются в ядре и сохраняют имена**. Меняется то, что они
возвращают: объект-стор вместо вызываемого хука. Это мажор `lanka` по
поведению, не по именам — правило 3 роутера соблюдено, `api/lanka.api.md` теряет
ни одного `value`, и меняет типы.

## Замеры, на которых это стоит

Сняты 2026-09-14 чтением дерева, не по памяти.

| Что                                                             | Число               | Как снято                                                                                        |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| файлов `core/src` без тестов                                    | 161                 | `find core/src -name '*.ts' -o -name '*.tsx' \| grep -v test\|bench`                             |
| из них импортируют `react`                                      | **1**               | `createLankaTrackedHook.ts` — `useCallback, useRef, useSyncExternalStore`                        |
| файлов фреймворка (core+modules+plugins+tools) с React-импортом | **2**               | второй — `tools/testing/src/renderWithLanka.tsx`, `@testing-library/react`                       |
| импортов корневого `zustand` (React-биндинг) в рантайме         | 2                   | `ALankaVM.ts` (`create`), `createSharedStoreLankaVM.ts` (`useStore`)                             |
| импортов корневого `zustand` только в типах                     | 5                   | `createLankaVM`, `ILankaVMContext`, `TLankaVMEnhancer`, `TLankaVMStateCreator`, `hydrateLankaVM` |
| импортов `zustand/vanilla`, `zustand/middleware`                | 3                   | `ALankaSharedStore`, `ILankaSharedStoreVMContext`, `lankaEncryptedStateStorage` — без хуков      |
| файлов `core/src/viewmodel` без тестов                          | 31                  | масштаб фазы 14.2                                                                                |
| рантайм-экспортов `@lankajs/tool-testing`                       | 11, React-зависим 1 | баррел кита: `renderWithLanka`                                                                   |
| модулей и плагинов, трогающих React                             | **0 из 17**         | grep по `from "react"`, React-хукам, `.tsx` в `src/`                                             |
| хостов в `_playgrounds/`                                        | 4, все React        | `react`, `next`, `astro`, `react-native` над одним `_shared`                                     |
| VM / gateways в `_shared`                                       | 7 / 5               | `ls _playgrounds/_shared/src/{ViewModels,Gateways}`                                              |
| `_shared` импортирует React                                     | нет                 | peer `react`/`zustand` там — только потому, что `lanka` их требует                               |

Базовые линии горячего пути, `perf/core.perf.md`, в единицах ярдстика:

| Операция                                     | × ярдстик | ±rme  |
| -------------------------------------------- | --------- | ----- |
| экран читает четыре ключа через tracked hook | 7631.17   | 6.19% |
| тот же экран читает plain object             | 4306.77   | 6.37% |
| сборка ViewModel (раз на экран)              | 342.58    | 7.18% |
| чтение через взведённый blind-spot trap      | 0.99      | 0.29% |
| action пишет одно поле                       | 3.84      | 1.57% |

Отношение tracked/plain = **1.77** — это стоимость трекера ПЛЮС React-рендера,
и сегодня они не разделены. Фаза 14.1 существует, чтобы разделить: после неё
у трекера своя строка без React, и 14.2 сравнивает с числом, а не с ощущением.

Ключевое различение, уже записанное в гейте —
[`check-runtime.mjs:134`](../scripts/check-runtime.mjs): «`zustand` bare is
React's binding — `create` calls hooks. `zustand/vanilla` and
`zustand/middleware` are not React». Зустанд остаётся peer-зависимостью ядра —
только vanilla-вход и middleware (`persist` у потребителей, `StateCreator`, на
котором построен `TLankaVMEnhancer`). Писать свой стор ради удаления зависимости
— обмен хорошего на никакое; корневой вход запрещается гейтом.

## Порт

Привязке нужна ТОЛЬКО сторона чтения. Это то, что делает stateless VM, shared
store и голый `createStore` из `zustand/vanilla` одинаково привязываемыми.

```ts
// lanka/viewmodel — фасад
export interface ILankaReadableVM<TState extends object> {
	/** Имя для логов, blind-spot предупреждения и сюиты. */
	readonly name: string;
	getState(): TState;
	/**
	 * Слушатель получает next и prev в ПОЛНОЙ форме — shared-store VM собирает
	 * полное состояние из среза здесь, привязка срезов не видит.
	 */
	subscribe(listener: (next: TState, prev: TState) => void): () => void;
	/** Что объявил `enableAccessTrackingOptimization`. Привязка это уважает. */
	readonly isAccessTracked: boolean;
}

export interface ILankaVM<TState> extends ILankaReadableVM<TState> {
	getInitialState(): TState;
	setState: StoreApi<TState>["setState"];
}

export type TLazyLankaVM<TStore> = TStore & { dispose(): void }; // уже есть
```

```ts
// lanka/extend — для авторов привязок
export const createLankaAccessTracker: <TState extends object>(
	vm: ILankaReadableVM<TState>,
) => {
	/** Proxy, записывающий прочитанные ключи; plain state, если трекинг выключен. */
	read(): TState;
	/** Нужно ли уведомлять: хоть один прочитанный ключ изменился по `Object.is`. */
	shouldNotify(next: TState, prev: TState): boolean;
	/** Состояние без Proxy — для серверного снимка. */
	readPlain(): TState;
};
```

Blind-spot trap остаётся в ядре и достаётся трекеру через `WeakMap<vm, trap>`, а
не через поле порта: репорт — dev-механика ядра, порт её не обещает. `read()`
кэширует Proxy по идентичности состояния — то, что сегодня делают
`trackedStateRef`/`trackedProxyRef`.

Что решает `surface-architect` в 14.2, а не этот план: имена (`ILankaReadableVM`
против `ILankaVMSource`), тир трекера (`extend` против `internal`), нужен ли
`getInitialState` на порте чтения. План фиксирует ФОРМУ — читающая половина,
полное состояние в подписке, флаг трекинга как свойство стора.

**Ограничение, которое порт не должен нарушить, ради 14.8.** Привязка достигает
стора ВЫЗОВОМ `useLankaVM(vm)` при каждом монтировании, а не захватом ссылки при
загрузке модуля. Сегодня это тривиально верно; оно должно остаться верным, потому
что per-request VM на сервере — это `vm`, которая под тем же именем на каждом
запросе другая. Ничего строить не нужно; нужно не построить обратного.

## Полка, и чем она отличается от трёх существующих

`modules/bindings/{react,vue,svelte,solid,angular}`, npm-имена плоские:
`@lankajs/react`, `@lankajs/vue`, `@lankajs/svelte`, `@lankajs/solid`,
`@lankajs/angular` — как `@lankajs/zod` не говорит «validators». Вид — `module`
(«app imports and calls it; core does not know it exists»); не плагин — ничего
не регистрируется через `use()`, ядро ничего не вызывает.

Четыре признака полки по 5d выполнены: один вид, один порт, билет —
`peerDependencies` на реальную библиотеку, сюита. Но гейт задаёт полке четыре
вопроса, и **второй здесь неверен**: `namesItsVendor` требует, чтобы имя вендора
встречалось в экспортах — «a package that is not vendor-bound is on the shelf
for no reason». Для валидаторов это правда: `lankaZodValidator` ↔
`lankaYupValidator`, приложение меняет пакет — и меняет одну строку. Привязку
никто не меняет установкой другой: слой view переписывается целиком. Что обещает
эта полка — не взаимозаменяемость, а **паритет возможностей**: переписанный
экран умеет то же самое.

Поэтому `FAMILIES` получает поле `kind: "interchangeable" | "parallel"`, по
умолчанию первое. Для `parallel` гейт пропускает вопрос 2 и задаёт остальные три
как есть: поверхности членов совпадают после анонимизации (здесь — буквально,
слова вендора в именах нет), полка держит только объявленное, каждый член
запускает сюиту. Отвергнутая альтернатива — вписать слово вендора в тип ради
гейта (`TLankaReactVMResult`) — это гейт, которому подыграли, а не гейт,
который проверил.

Второе следствие: **имя одно на всех — `useLankaVM`**. Vue и React — это их
идиома; Svelte 5 и Solid чаще пишут `create*`, Angular — `inject*`. TanStack
пошёл по идиомам (`useQuery`/`createQuery`) и получил пять документаций. Полка
`parallel` существует ровно для обратного: GUIDE и шипуемый скилл читаются
одинаково на всех пяти, и разница между фреймворками — в возвращаемом типе
(`State` / `ShallowRef<State>` / объект с геттерами / `Accessor<State>` /
`Signal<State>`), а не в имени. Это то, что гейт сравнения делает проверяемым.

Тестовый рендер — подпуть `@lankajs/<fw>/testing` с `renderWithLanka`, peer на
`@testing-library/<fw>` как `peerOptional` (реестр это умеет:
[`registry.mjs:1511`](../scripts/registry.mjs)). Он уходит из кита: кит зависит
от `lanka` и ни от чего больше, и тянуть в него React ради одной функции —
инверсия направления. Это удаление опубликованного имени из
`@lankajs/tool-testing` — мажор кита, и changeset говорит куда оно уехало.
`check-family` сегодня сравнивает только `src/index.ts`; в 14.3 он сравнивает
каждый опубликованный вход, иначе подпуть `testing` — место, где члены
расходятся незамеченными.

## Поле `framework` — вторая ось, не вторая папка

«Требует React» — факт той же формы, что «требует DOM», и репозиторий уже
выразил второй полем: `@lankajs/browser` лежит не в папке `browser/`, а
объявляет `runtime: ["browser"]`. Папка `frameworks/` склеила бы две
ортогональные оси — вид (отношение к ядру) и фреймворк (что установить), — и
React-специфичный ПЛАГИН оказался бы вне `plugins/`, а шесть гейтов, спрашивающих
«эта директория — плагин?», получили бы второй ответ.
[`registry.mjs:69`](../scripts/registry.mjs): «two readings of one directory
tree is how a bucket silently becomes a package».

`framework?: "react" | "vue" | "svelte" | "solid" | "angular"` в реестре, закрытый
список как `runtime`. `check-runtime.mjs` обобщает `CLIENT_PACKAGES` в таблицу
по фреймворкам:

| framework | пакеты                                 |
| --------- | -------------------------------------- |
| react     | `react`, `react-dom`, `zustand` (bare) |
| vue       | `vue`, `@vue/*`                        |
| svelte    | `svelte`, `svelte/*`                   |
| solid     | `solid-js`, `solid-js/*`               |
| angular   | `@angular/*`                           |

Теги: `[framework-undeclared]` — вход импортирует фреймворк, не объявив;
`[framework-unused]` — объявил и не импортирует ни в одном входе (полка без
билета); `[framework-unknown]` — не из списка. Правило `"use client"`
применяется только к входам с `framework: "react"` — RSC есть у одного
фреймворка, и сегодняшний гейт молча считает его общим.

Ядро не объявляет `framework` — и с этой минуты гейт ДОКАЗЫВАЕТ чистоту ядра,
а не план её утверждает. Будущий `@lankajs/react-forms` — `modules/react-forms`
с `framework: "react"`, НЕ на полке: он не биндит порт, сравнивать его не с чем,
и 5d прямо называет исключение из сравнения «the thing to refuse by default».

## Плейграунды — где, какие, что доказывают

Два контракта плейграунда, и у каждого своя таблица сцен:

**SPA** — «every package a browser can run», зеркало `_playgrounds/react`: те же
семь VM из `_shared`, те же экраны, тот же `atlas-browser.live.test.ts` по
настоящему проводу. Доказывает привязку под нагрузкой всего фреймворка.

**HOST** — зеркало `_playgrounds/next`: `runLankaRequest` там, где у хоста живёт
запрос; `runLankaStatic` на пререндеренном маршруте, ОТКАЗЫВАЮЩИЙ заголовкам;
`hydrateLankaVM` один раз и тихо во второй; рецепт `tool-di`; граница клиента,
если у хоста она есть. Доказывает, что слой хоста не знает фреймворка.

| Плейграунд                             | Контракт | Привязка           | Фаза        | Что только он показывает                                                                                                           |
| -------------------------------------- | -------- | ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `react` (есть)                         | SPA      | `@lankajs/react`   | 14.2        | регрессия: сегодняшнее поведение на новом порте                                                                                    |
| `next`, `react-native` (есть)          | HOST     | `@lankajs/react`   | 14.2        | то же для двух бандлеров и RSC                                                                                                     |
| **`astro` (есть, растёт в 14.4–14.7)** | HOST×N   | ВСЕ пять           | 14.2 → 14.7 | единственный хост, несущий острова пяти фреймворков СРАЗУ — см. ниже                                                               |
| **`vanilla`**                          | SPA      | нет                | 14.2        | DOM руками от `getState`/`subscribe`; в графе нет ни одного фреймворка                                                             |
| **`node`**                             | —        | нет                | 14.2        | headless-потребитель: SSE и сокет в node, VM через `subscribe`, `runLankaRequest` как middleware; `check-runtime` на графе без DOM |
| **`vue`**                              | SPA      | `@lankajs/vue`     | 14.4        | первая не-React модель реактивности                                                                                                |
| **`nuxt`**                             | HOST     | `@lankajs/vue`     | 14.4        | Nitro server route → `runLankaRequest`; payload → `hydrateLankaVM`; нет `"use client"`                                             |
| **`svelte`**                           | SPA      | `@lankajs/svelte`  | 14.5        | компилятор, не рантайм                                                                                                             |
| **`sveltekit`**                        | HOST     | `@lankajs/svelte`  | 14.5        | `hooks.server.ts` `handle` → область запроса; `+page.server.ts` `load` → данные                                                    |
| **`solid`**                            | SPA      | `@lankajs/solid`   | 14.6        | без виртуального DOM, без перерендера компонента                                                                                   |
| **`solid-start`**                      | HOST     | `@lankajs/solid`   | 14.6        | Vinxi/Nitro — второй хост на Nitro, что проверяет, что раздел GUIDE про Nitro общий                                                |
| **`angular`**                          | SPA+HOST | `@lankajs/angular` | 14.7        | один проект: Angular SSR — встроенный режим, а не мета-фреймворк; DI-контейнер как владелец жизненного цикла                       |

**Astro — доказательство, которого не даёт ни один другой хост.** Astro на
официальных интеграциях монтирует острова React, Vue, Svelte и Solid в ОДНОЙ
странице, одного процесса, одного бандла. Поэтому он не «ещё один HOST», а
единственное место, где проверяемо следующее:

1. пять привязок сосуществуют в одном графе модулей — ни одна не тянет чужой
   фреймворк и не ломает чужой рендер;
2. одна VM из `_shared` читается островом React и островом Vue ОДНОВРЕМЕННО, и
   оба видят одно состояние — то есть стор действительно общий, а привязка
   действительно только читает;
3. `hydrateLankaVM` применяется один раз на стор, даже когда островов, читающих
   его, несколько и они на разных фреймворках;
4. сценарий, выпущенный островом Svelte, доходит до острова Solid — шина
   фреймворка не знает вовсе, и это видно глазами.

Сцена 2 — самая дорогая из всех в плане и самая содержательная: если она
зелёная, «фреймворк-независимо» перестаёт быть утверждением о графе импортов и
становится утверждением о РАБОТЕ. Она получает отдельный список
`ATLAS_ISLAND_SCENES` и живёт только в `_playgrounds/astro`.

Astro поэтому меняется в каждой фазе с 14.4 по 14.7: приходит привязка — в
астро-плейграунд добавляется остров на ней плюс интеграция в `astro.config`,
и `check-playgrounds` требует, чтобы число островов равнялось числу членов
полки. Astro — не пятый хост в списке, а ratchet на полку.

Angular в островах Astro НЕ участвует: официальной интеграции `@astrojs/angular`
нет, а писать свою — это построить мета-фреймворк ради сцены. `ATLAS_ISLAND_SCENES`
поэтому говорят «каждая привязка, у которой есть интеграция Astro», и список
интеграций лежит рядом с ними как данные — чтобы отсутствие Angular было
записанным фактом, а не забытым островом.

Angular — один плейграунд, не два: SSR в Angular включается в тот же проект
(`server.ts` от CLI), отдельного мета-фреймворка мейнстрим не имеет; Analog
отвергнут как нишевой. Preact — не плейграунд и не пакет: `preact/compat`
запускает `@lankajs/react`, строка в GUIDE. Qwik отвергнут: resumability требует
сериализуемого состояния, стор с функциями-actions не сериализуется — это
конфликт архитектур, не недостающая привязка.

**«Абсолютно всё» делается проверяемым, а не желаемым.** Пять SPA-плейграундов
расходятся ровно так, как разошлись бы шесть рукописных сюит валидаторов — не в
день написания, а в день, когда один получит сцену, а четыре нет. Поэтому:

- `_playgrounds/_shared/src/atlasScenes.ts` — три списка имён сцен как ДАННЫЕ:
  `ATLAS_SPA_SCENES` (по одной на строку таблицы из `react/README.md` — десять
  пакетов — плюс по одной на каждую из семи VM плюс live-тест провода),
  `ATLAS_HOST_SCENES` (пять сцен контракта HOST выше) и `ATLAS_ISLAND_SCENES`
  (четыре сцены сосуществования, только для Astro), рядом с ними
  `ASTRO_ISLAND_BINDINGS` — какие привязки имеют интеграцию Astro;
- `_playgrounds/hosts.mjs` — список хостов с контрактом каждого, потому что
  плейграунды не в `registry.mjs` и не должны там быть;
- `scripts/check-playgrounds.mjs` — каждый хост содержит тест, называющий каждую
  сцену своего контракта, по той же механике, что `runsTheSuite` в
  `check-family`; плюс правило Astro: остров на каждую привязку из
  `ASTRO_ISLAND_BINDINGS`, и этот список обязан совпадать с членами полки минус
  объявленные исключения. В цепочку как `check:playgrounds` после `check:apps`.
  Гейт доказывается на хосте с удалённой сценой ДО того, как ему поверят.

Каждый пакет-привязка при этом имеет и свой `_playground/` по правилу 6 — там
вызывается conformance-сюита над игрушечными VM, как `lankaValidatorConformance`
вызывается из плейграунда каждого валидатора. Сюита проверяет привязку; SPA
проверяет привязку под приложением; HOST проверяет хост. Три вопроса, три места.

## Скиллы

Три читателя, три набора изменений.

**Канон (`skills/`), никогда не шипуется:**

| Файл                    | Что меняется                                                                                                                                                                                                                                                                                                  | Фаза             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `hosts/SKILL.md`        | строка `viewmodel \| React and zustand \| CLIENT` → `viewmodel \| zustand/vanilla \| universal`; правило 4 («the framework declares its own client boundary») — под `framework: "react"`; новый §: две оси — фреймворк и хост, чеклист хоста (раздел GUIDE, рецепт, плейграунд), Nitro/edge и `nodejs_compat` | 14.0, 14.2, 14.4 |
| `structure/SKILL.md` 5d | `parallel` против `interchangeable`; почему привязки — полка, а `react-forms` — нет                                                                                                                                                                                                                           | 14.3             |
| `parity/SKILL.md`       | новое правило: привязка не добавляет возможностей сверх порта; сюита — проверка паритета поперёк фреймворков; одно имя `useLankaVM` и почему не идиома                                                                                                                                                        | 14.3             |
| `naming/SKILL.md`       | экземпляр VM больше не `use*` — `todoVM`, не `useTodoVM`; префикс `use` зарезервирован за привязками; `check-naming` — правило                                                                                                                                                                                | 14.2             |
| `surface/SKILL.md`      | тир порта (facade) и трекера (`extend`); что публикует полка и что подпуть `testing`                                                                                                                                                                                                                          | 14.2             |
| `gates/SKILL.md`        | `framework` в `check-runtime`; `parallel` в `check-family`; `check-playgrounds`                                                                                                                                                                                                                               | 14.0, 14.3       |
| `testing/SKILL.md`      | где живёт тест привязки; адаптер сюиты; почему React-тесты уехали из ядра                                                                                                                                                                                                                                     | 14.2             |
| `performance/SKILL.md`  | у каждой привязки свой бенч и `perf/<fw>.perf.md`; ярдстик общий                                                                                                                                                                                                                                              | 14.1             |

**Пакетные (`<pkg>/SKILL.md`), не шипуются:** новый на каждую привязку — что в
ней нельзя менять: одна функция, ноль логики трекинга (она в ядре), сюита
обязательна.

**Потребительские (`<pkg>/skills/lanka-<slug>/SKILL.md`), шипуются —
пишутся рукой, `reference.md` генерируется из GUIDE:**

| Скилл                                     | Что                                                                                           | Фаза      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | --------- |
| `core/skills/lanka-core`                  | VM — объект, не хук; `getState`/`subscribe` — весь API без фреймворка; куда идти за привязкой | 14.2      |
| `modules/bindings/<fw>/skills/lanka-<fw>` | по одному: как читать VM в этом фреймворке, blind-spot и флаг, серверный снимок, `testing`    | 14.2–14.7 |
| `modules/host/skills/lanka-host`          | разделы Nuxt, SvelteKit, SolidStart, Angular SSR; Nitro как общий раздел                      | 14.4–14.7 |
| `tools/di/skills/lanka-di`                | рецепты: Nuxt/SvelteKit/Solid через `vite`; Angular через `setup` + CLI                       | 14.4–14.7 |
| `tools/testing/skills`                    | `renderWithLanka` переехал, куда и почему                                                     | 14.2      |
| `core/skills/lanka-packages`              | полка привязок в списке; поле `framework` в описании пакета                                   | 14.3      |

`ARCHITECTURE.md` — таблица слоёв (view становится «фреймворк по выбору, через
привязку»), «Inside another framework» — по разделу на новый хост. `llms.txt`,
`AGENTS.md`, маркетплейс `.claude-plugin/` — регенерируются, `check:llms` и
`check:drift` следят.

## Эдж-кейсы, закрытые здесь

1. **Ленивый Proxy** — [`createLazyLankaHook`](../core/src/viewmodel/_internal/create-lazy-lanka-hook/createLazyLankaHook.ts) оборачивает ФУНКЦИЮ, чтобы `useVM()` был вызываем. Цель — объект; `forwardEveryMember` не меняется, ловушка `then/catch/finally` остаётся (deadlock через `await` никуда не делся), `dispose` по-прежнему единственный член, не строящий стор.
2. **Stateless VM** — состояние не меняется; порт чтения удовлетворяется `subscribe`, возвращающим no-op и не стреляющим никогда. Сцена 7 сюиты.
3. **Shared-store VM** — сборка полного состояния из среза остаётся в ядре, внутри `subscribe`; привязка срезов не видит. Это уже так — `ILankaTrackedHookConfig.subscribe` документирует именно это.
4. **Svelte** — runes работают только в `.svelte`/`.svelte.ts`, а пакет собирается `tsup`. Привязка через `createSubscriber` из `svelte/reactivity` (≥ 5.7) — plain TS, интегрируется с runes. Store-контракт `{ subscribe }` отвергнут: работает, но это legacy-путь и не композируется с `$state`. Peer `svelte: ^5.7`.
5. **Vue вне effect scope** — `onScopeDispose` не сработает; возвращаемое несёт явный `stop()`, сцена 5 сюиты проверяет его через адаптер.
6. **Angular** — `useLankaVM` только в injection context (`assertInInjectionContext`), иначе — предложение с именем места, где вызывать. Zoneless — штатно, потому что сигналы.
7. **Solid** — `from(subscribe)` читает начальное значение синхронно; трекер применяется поверх.
8. **React 18** — `useSyncExternalStore` есть с 18, но peer остаётся `^19.2` как сегодня: расширение диапазона — отдельное измеренное решение, не побочный эффект.
9. **StrictMode** двойная подписка — сцена 9 считает подписки на N рендеров; сегодняшний замер «201 на 200» — то, что она обязана не пропустить.
10. **`hydrateLankaVM`** принимает `ILankaVM` структурно: голый `createStore` из vanilla тоже проходит. Для потребителя это НЕ мажор `@lankajs/host` — сужение типа, под которое старый стор подходит.
11. **`_shared`** теряет peer `react` и `zustand`: они там потому, что `lanka` их требует, и уходят вместе с требованием.
12. **Edge-рантаймы хостов** — Nitro на Cloudflare, SvelteKit `adapter-cloudflare`: `node:async_hooks` только за `nodejs_compat`. `@lankajs/host/server` остаётся `runtime: ["node"]`; GUIDE называет флаг; вторая реализация поверх web-стандартного `AsyncContext` — когда он стабилизируется, не здесь.
13. **`@lankajs/react` и `@lankajs/react-native-async-storage`** — разные полки, коллизии нет; RN использует `@lankajs/react` с `runtime: ["browser","native"]`.
14. **React-тесты в ядре** — `createLankaVM.subscriptionStability.test.tsx`, `createLankaTrackedHook.bench.tsx` переезжают в привязку; `core/vitest.domTests.ts` проверяется на надобность.
15. **`enhancers()`** — `persist`, `lankaDevtools` — middleware `zustand/middleware` поверх `createStore` vanilla совместимы как есть.
16. **Direction** — `lanka` не зависит от `@lankajs/react` даже в dev; привязка тестируется своим `_playground/` и сюитой, ядро — без React вообще.

## Фазы

### 14.0 — поле `framework` и гейт

| Файл                                                | Что                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `scripts/registry.mjs`                              | `framework?` в типе пакета и входа, закрытый список; пока не объявляет никто                          |
| `scripts/check-runtime.mjs`                         | `CLIENT_PACKAGES` → `FRAMEWORK_PACKAGES` по таблице выше; три тега; `"use client"` только при `react` |
| `scripts/check-runtime.test.mjs`                    | по спеке на тег; спека «ядро импортирует react и не объявляет» ПАДАЕТ — красный до зелёного           |
| `scripts/scaffold.mjs`                              | `framework` в README пакета рядом с `runtime`                                                         |
| `skills/gates/SKILL.md`, `skills/hosts/SKILL.md` §4 | правило и владелец                                                                                    |

Сегодня ядро импортирует React, и после этой фазы гейт ОБЯЗАН быть красным на
ядре. Временно ядро объявляет `framework: "react"` — честная запись факта, а не
исключение из гейта; 14.2 снимает объявление, и снятие — это тест.

Размер: 4 файла, ~1 новая спека на тег. Переход: `pnpm check` зелёный, гейт
доказан падающим на ядре без объявления.

### 14.1 — чистый трекер, и его число

| Файл                                                                                   | Что                                                                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `core/src/viewmodel/_internal/create-lanka-access-tracker/createLankaAccessTracker.ts` | Proxy, набор ключей, `shouldNotify`, кэш по идентичности, `readPlain`; ноль React                         |
| `…/createLankaAccessTracker.test.ts`                                                   | сцены трекинга, снятые с сегодняшнего хука: читаем 4 ключа, меняем 5-й — не уведомляет; blind-spot репорт |
| `…/createLankaAccessTracker.bench.ts`                                                  | «read четырёх ключей через Proxy» и «shouldNotify на 4 из 20» — против ярдстика                           |
| `…/create-lanka-tracked-hook/createLankaTrackedHook.ts`                                | становится ~15 строк: `useRef` на трекер, `useCallback` на subscribe, `useSyncExternalStore`              |
| `perf/core.perf.md`                                                                    | строка трекера — записывается; строка хука — не хуже 7631 в пределах rme                                  |

Поверхность не меняется, React остаётся. Отдельно от 14.2 потому, что это
горячий путь, и число должно быть снято ДО того, как к нему прибавится всё
остальное: если трекер подорожал, узнать это здесь, а не внутри мажора.

Размер: 1 файл разрезается на 2, +1 спека, +1 бенч. Переход: `bench-runner`
по A/B-протоколу на простаивающей машине — три прогона, медиана; отношение
хука к plain не выросло; коммит с числами.

### 14.2 — порт, чистое ядро, `@lankajs/react`, ваниль и node

Мажор `lanka` и мажор `@lankajs/tool-testing`. Одна фаза, потому что ни одна
половина не зелёная без другой: ядро без хука ломает четыре плейграунда, а
привязка без порта не существует.

**Ядро:**

| Файл                                                                | Что                                                                                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `core/src/viewmodel/_interfaces/ILankaReadableVM.ts`, `ILankaVM.ts` | порт, по решению `surface-architect`                                                                                 |
| `…/_abstractions/lanka-vm/ALankaVM.ts`                              | `create` → `createStore` из `zustand/vanilla`; `build()` возвращает `ILankaVM`; `name`, `isAccessTracked` на объекте |
| `…/_factories/create-shared-store-lanka-vm/…`                       | без `useStore`; сборка полного состояния — внутри `subscribe`                                                        |
| `…/_abstractions/lanka-stateless-vm/ALankaStatelessVM.ts`           | объект с `getState` и no-op `subscribe`                                                                              |
| `…/_internal/create-lazy-lanka-hook/` → `create-lazy-lanka-vm/`     | цель — объект; переименование по `skills/naming`                                                                     |
| `…/_internal/create-lanka-tracked-hook/`                            | УДАЛЯЕТСЯ из ядра; его тесты и бенч едут в привязку                                                                  |
| `…/_types/TLankaVMEnhancer.ts`, `TLankaVMStateCreator.ts`           | `StateCreator` из `zustand/vanilla`                                                                                  |
| `core/src/viewmodel/index.ts`                                       | без `"use client"` — гейт 14.0 требует снять; экспорт порта                                                          |
| `core/src/_extend/index.ts`                                         | `createLankaAccessTracker`                                                                                           |
| `scripts/registry.mjs`                                              | ядро: `peer` без `react`, без `framework`; `tiers` — трекер в `extend`                                               |
| `api/lanka.api.md`                                                  | регенерация; `check-api` показывает диф — он и есть ревью                                                            |
| `perf/core.perf.md`                                                 | строка хука уходит с файлом; строка трекера остаётся                                                                 |

**Полка и первый член:**

| Файл                                                                    | Что                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/registry.mjs`                                                  | `FAMILIES` += `{ kind: "module", slug: "bindings", parallel: true, conformance: "lankaViewBindingConformance" }`; член `react`: `framework: "react"`, `runtime: ["browser","native"]`, `peer: { lanka, react }`, `peerOptional: ["@testing-library/react"]`, `entries: [{ name: "testing", … }]` |
| `modules/bindings/react/src/use-lanka-vm/useLankaVM.ts`                 | `useSyncExternalStore` + трекер; ~20 строк                                                                                                                                                                                                                                                       |
| `modules/bindings/react/src/index.ts`                                   | `"use client"`; `useLankaVM`                                                                                                                                                                                                                                                                     |
| `modules/bindings/react/src/testing.ts`                                 | `renderWithLanka` из кита, без изменений семантики                                                                                                                                                                                                                                               |
| `modules/bindings/react/_playground/`                                   | вызов `lankaViewBindingConformance` с React-адаптером (RTL); `subscriptionStability` — здесь                                                                                                                                                                                                     |
| `modules/bindings/react/src/use-lanka-vm/useLankaVM.bench.tsx`          | бывший `createLankaTrackedHook.bench.tsx`; `perf/react.perf.md`                                                                                                                                                                                                                                  |
| `modules/bindings/react/{README,GUIDE,SKILL}.md`, `skills/lanka-react/` | по таблице скиллов                                                                                                                                                                                                                                                                               |

`check-family` в этой фазе ещё сравнивать нечего — член один, сюита есть, полка
легальна по 5d. `parallel` понадобится только когда появится `namesItsVendor`
на пакете без слова вендора — то есть сразу; поле вводится здесь как флаг, гейт
учится его читать в 14.3. Порядок «сначала флаг, потом гейт» — потому что гейт,
меняющий семантику, проходит `adversarial-reviewer`, и делать это внутри мажора
— две ревизии в одной.

**Сюита в ките:**

| Файл                                                                              | Что                                                                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `tools/testing/src/lanka-view-binding-conformance/lankaViewBindingConformance.ts` | одиннадцать сцен как ДАННЫЕ над адаптером `{ vendor, mount(vm, read) → { current, renders, unmount, act }, renderToString? }` |
| `…/lankaViewBindingConformance.test.ts`                                           | нарочно сломанный адаптер — каждая сцена ПАДАЕТ по отдельности                                                                |
| `tools/testing/src/index.ts`                                                      | минус `renderWithLanka`; changeset «мажор, переехало в `@lankajs/react/testing`»                                              |

Сцены — это контракт для сторонних авторов, потому пишутся здесь целиком:

1. первое чтение равно `getState()`;
2. изменение прочитанного ключа обновляет `current()` и даёт ровно один рендер;
3. изменение НЕпрочитанного ключа не рендерит (для `isAccessTracked`);
4. с селектором рендерит только изменение результата селектора;
5. `unmount` снимает подписку — счётчик слушателей на обёрнутом `vm` возвращается к нулю;
6. два монтирования одной VM видят одно состояние;
7. stateless VM монтируется и не рендерится никогда;
8. ленивая VM строится на первом монтировании, не на импорте; `dispose` снимает подписки;
9. N перерендеров — одна подписка (замер «201 на 200» как то, что нельзя пропустить);
10. в dev изменение непрочитанного ключа при трекинге репортится с именем VM — только для plain VM, не для shared-store;
11. `renderToString`, если адаптер его даёт: вывод содержит состояние и не создаёт ни одной подписки; без адаптера сцена пишется как ПРОПУЩЕННАЯ, не как пройденная.

**Остальное в фазе:**

| Файл                                                                                                 | Что                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/host/src/hydrate-lanka-vm/hydrateLankaVM.ts`                                                | тип параметра — `ILankaVM`; рантайм не трогается                                                                                                               |
| `tools/eslint/src/_rules/lanka-use-lanka-vm/`                                                        | `useX()` → `useLankaVM(x)`, `useX(sel)` → `useLankaVM(x, sel)`, `useX.getState()` → `x.getState()`; с автофиксом — это цена мажора, заплаченная за потребителя |
| `tools/eslint/src/lanka-boundaries/`                                                                 | слой привязок между ViewModels и views                                                                                                                         |
| `scripts/check-naming.mjs`                                                                           | экземпляр VM без `use`; правило и его красная спека                                                                                                            |
| `_playgrounds/_shared`                                                                               | `useAtlasBoardVM` → `atlasBoardVM` и т.д. (7 VM); peer `react`/`zustand` — долой; `atlasScenes.ts`                                                             |
| `_playgrounds/{react,next,astro,react-native}`                                                       | экраны на `useLankaVM(…)` из `@lankajs/react`; поведение неизменно — это и есть регрессия                                                                      |
| **`_playgrounds/vanilla`**                                                                           | Vite без фреймворка; экраны — DOM от `subscribe`; SPA-сцены; зависимости: `lanka`, модули, ничего с `framework`                                                |
| **`_playgrounds/node`**                                                                              | headless: SSE и сокет против `_server`, VM через `subscribe`, `runLankaRequest` как http-middleware; `check-runtime` на графе — ни `document`, ни `react`      |
| `_playgrounds/hosts.mjs`, `scripts/check-playgrounds.mjs`                                            | список и гейт; спека «хост без сцены» падает                                                                                                                   |
| `skills/{naming,surface,testing,hosts}`, `ARCHITECTURE.md`, скиллы `lanka-core`, `lanka-react`, кита | по таблице скиллов                                                                                                                                             |
| `.changeset/`                                                                                        | `lanka` major, `@lankajs/tool-testing` major, `@lankajs/host` minor, `@lankajs/react` первый                                                                   |

Размер: 31 файл `viewmodel`, из них ~10 меняются и 3 уезжают; 2 в host; 1 в
ките; ~8 экранов в четырёх плейграундах; два новых плейграунда — не измерено,
ориентир — `react/` (25 файлов в `src`). Самая большая фаза плана, и она не
делится: любая её половина — красный `check`.

Переход: `surface-architect` на порт ДО кода; `pnpm check` зелёный, включая
`check:playgrounds` с двумя новыми хостами; `check:perf` — `react.perf.md` не
хуже строки хука из 14.1, `core.perf.md` без строки хука и с трекером; сюита
доказана падающей; четыре старых плейграунда ведут себя как раньше;
`adversarial-reviewer` перед тем, как мажор считается готовым к релизу.

### 14.3 — гейт полки учится `parallel`

| Файл                                                                              | Что                                                                                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/check-family.mjs`                                                        | `parallel` пропускает `namesItsVendor`; сравнение по КАЖДОМУ опубликованному входу, не только `src/index.ts`                               |
| `scripts/check-family.test.mjs`                                                   | «parallel-полка с вендором в имени» — проходит; «interchangeable без вендора» — падает как раньше; «члены расходятся в `testing`» — падает |
| `skills/structure/SKILL.md` 5d, `skills/parity/SKILL.md`, `skills/gates/SKILL.md` | правило, владелец, отвергнутая альтернатива                                                                                                |
| `core/skills/lanka-packages`                                                      | полка в списке                                                                                                                             |

Отдельной фазой — потому что меняется семантика гейта, и это проходит
`adversarial-reviewer` в чистом контексте.

Размер: 1 гейт, 3 спеки, 3 файла канона. Переход: обе новые спеки красные до
правки и зелёные после; старые семьи проходят без изменений.

### 14.4 — `@lankajs/vue`, `_playgrounds/vue`, `_playgrounds/nuxt`

Первое настоящее доказательство: по 5d двойник кита — «вторая реализация порта»,
но кит — не фреймворк. Vue — первая с другой моделью реактивности, и это то, что
отделяет «React, абстрагированный на уровень» от «фреймворк-независимо».

| Файл                                                             | Что                                                                                                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/registry.mjs`                                           | член `vue`: `framework: "vue"`, `runtime: ["browser"]`, `peer: { lanka, vue: "^3.5" }`, `peerOptional: ["@testing-library/vue"]`                           |
| `modules/bindings/vue/src/use-lanka-vm/useLankaVM.ts`            | `shallowRef` + `subscribe` + трекер; `onScopeDispose` если есть scope, иначе явный `stop()` в возвращаемом                                                 |
| `modules/bindings/vue/src/testing.ts`                            | `renderWithLanka` над `@testing-library/vue`                                                                                                               |
| `modules/bindings/vue/_playground/`                              | сюита с Vue-адаптером; `check-family` впервые СРАВНИВАЕТ два члена                                                                                         |
| `_playgrounds/vue`                                               | SPA: зеркало `react/` — те же экраны как SFC, те же SPA-сцены, тот же live-тест                                                                            |
| `_playgrounds/nuxt`                                              | HOST: `server/api/*` → `runLankaRequest`; пререндер → `runLankaStatic`; `useState`-payload → `hydrateLankaVM`; `nuxt.config` с `lanka-di-vite`; HOST-сцены |
| `_playgrounds/astro`                                             | +остров на Vue (`@astrojs/vue`): первая проверка сосуществования — React и Vue читают ОДНУ VM на одной странице; `ATLAS_ISLAND_SCENES` заводятся здесь     |
| `modules/host/GUIDE.md`                                          | § Nuxt; § Nitro — общий, потому что 14.6 придёт с SolidStart на том же Nitro                                                                               |
| `tools/di/GUIDE.md`                                              | рецепт Nuxt                                                                                                                                                |
| `perf/vue.perf.md`, скиллы `lanka-vue`, `lanka-host`, `lanka-di` |                                                                                                                                                            |

Размер: 1 хук, 1 подпуть, 1 сюитный плейграунд, 2 плейграунда приложения (~25 и
~15 файлов по образцу `react/` и `next/`), 2 раздела GUIDE. Переход: сюита
зелёная на Vue без единой правки сцен — если сцену пришлось менять, порт был
React-образным, и это возвращает в 14.2; `check-family` сравнивает два члена и
молчит; `check:playgrounds` зелёный на vue и nuxt.

### 14.5 — `@lankajs/svelte`, `_playgrounds/svelte`, `_playgrounds/sveltekit`

| Файл                                                                                           | Что                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/registry.mjs`                                                                         | член `svelte`: `peer: { svelte: "^5.7" }`, `peerOptional: ["@testing-library/svelte"]`                                                                                      |
| `modules/bindings/svelte/src/use-lanka-vm/useLankaVM.ts`                                       | `createSubscriber` из `svelte/reactivity`; возвращает объект с геттерами по ключам — каждый геттер вызывает подписчик и читает через трекер                                 |
| `_playgrounds/svelte`                                                                          | SPA-зеркало                                                                                                                                                                 |
| `_playgrounds/astro`                                                                           | +остров на Svelte (`@astrojs/svelte`); три фреймворка на одной странице                                                                                                     |
| `_playgrounds/sveltekit`                                                                       | HOST: `hooks.server.ts` `handle` → `runLankaRequest` на запрос; `+page.server.ts` `load` → данные; `prerender = true` маршрут → `runLankaStatic`; `data` → `hydrateLankaVM` |
| `modules/host/GUIDE.md` § SvelteKit; `tools/di/GUIDE.md` рецепт; `perf/svelte.perf.md`; скиллы |                                                                                                                                                                             |

Переход: как 14.4, плюс проверка эдж-кейса 4 — пакет собирается `tsup` без
Svelte-компилятора и работает в `.svelte`.

### 14.6 — `@lankajs/solid`, `_playgrounds/solid`, `_playgrounds/solid-start`

| Файл                                                    | Что                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `scripts/registry.mjs`                                  | член `solid`: `peer: { "solid-js": "^1.9" }`, `peerOptional: ["@solidjs/testing-library"]`             |
| `modules/bindings/solid/src/use-lanka-vm/useLankaVM.ts` | `from(subscribe)` + трекер; `Accessor<State>`                                                          |
| `_playgrounds/solid`, `_playgrounds/solid-start`        | SPA-зеркало; HOST на Vinxi/Nitro — раздел § Nitro из 14.4 обязан подойти без правок, иначе он не общий |
| `_playgrounds/astro`                                    | +остров на Solid (`@astrojs/solid-js`); четыре фреймворка — полный `ATLAS_ISLAND_SCENES`               |
| GUIDE, рецепт, `perf/solid.perf.md`, скиллы             |                                                                                                        |

### 14.7 — `@lankajs/angular`, `_playgrounds/angular`

| Файл                                                        | Что                                                                                                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/registry.mjs`                                      | член `angular`: `peer: { "@angular/core": "^20" }`, `peerOptional: ["@testing-library/angular"]`                                                                                                                           |
| `modules/bindings/angular/src/use-lanka-vm/useLankaVM.ts`   | `signal` + `subscribe` + трекер; `inject(DestroyRef).onDestroy`; `assertInInjectionContext`                                                                                                                                |
| `_playgrounds/angular`                                      | один проект, SSR включён: SPA-сцены и HOST-сцены в нём; `tool-di` через `lankaDiSetup` (tsconfig paths) + CLI для скаффолда — CLI Angular не принимает esbuild-плагинов штатно, и это проверяется здесь, не предполагается |
| GUIDE § Angular SSR, рецепт, `perf/angular.perf.md`, скиллы |                                                                                                                                                                                                                            |

Переход: пять членов на полке, сюита зелёная на всех без правок сцен со времён
14.4; `check-family` сравнивает пять поверхностей.

### 14.8 — сервер как область жизни

Не привязка. Сегодня серверная история честна и документирована в
`_playgrounds/next/README.md`: VM — стор уровня модуля, «one per PROCESS», и
пользовательские поля живут в состоянии компонента. `_playgrounds/node` из 14.2
показывает, что `runLankaRequest` даёт область ИНСТАНСУ; чего он не даёт — это
области VM.

| Файл                                                                                    | Что                                                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `core/src/viewmodel/_factories/define-lanka-vm/`                                        | `defineLankaVM(config)` → определение; `resolveLankaVM(def)` → экземпляр текущей области: инстанс в браузере, запрос на сервере |
| `modules/bindings/*/src/use-lanka-vm/`                                                  | перегрузка: `useLankaVM(def)` резолвит при монтировании — то ограничение из раздела «Порт», ради которого оно там записано      |
| `modules/host/src/server.ts`                                                            | реестр экземпляров VM в области запроса                                                                                         |
| сюита                                                                                   | сцена 12: два `renderToString` в двух областях не видят состояния друг друга                                                    |
| `_playgrounds/node`, `_playgrounds/next`, `_playgrounds/nuxt`, `_playgrounds/sveltekit` | форма из `next/README.md` переезжает из `useState` в scoped VM                                                                  |

Это новая опубликованная поверхность, и она получает ОТДЕЛЬНЫЙ проход
`surface-architect`; если её форма потребует больше одной фазы — это план 15, и
настоящий план закрывается на 14.7 с тем, что здесь записано, как с харвестом.
Не делается раньше 14.7 сознательно: пять привязок должны лечь на порт-экземпляр
ПРЕЖДЕ, чем порт получит второй способ достать экземпляр — иначе неизвестно,
что именно они доказали.

## Порядок, и почему такой

0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8; 5, 6, 7 независимы между собой и могут идти
параллельно после 4.

- **0 перед всем**: гейт, который делает утверждение «ядро чистое» проверяемым,
  должен существовать до того, как утверждение сделано.
- **1 перед 2**: число трекера снимается без React, чтобы у 2 был эталон.
- **2 неделимо**: см. выше — любая половина красная.
- **3 после 2**: семантика гейта меняется отдельно от мажора; два ревью в одном
  контексте — одно ревью.
- **4 перед 5–7**: Vue — первое доказательство; если оно вернёт в 2, три
  остальных не начинались зря.
- **8 последним**: второй способ достать экземпляр — после того, как первый
  доказан пятью способами.

## Как добавить шестой фреймворк

Это чеклист масштабируемости, и он уходит в GUIDE «writing a binding» при
харвесте:

1. строка члена в `FAMILIES`-полке `bindings`: `framework`, `runtime`, `peer`,
   `peerOptional`, вход `testing`;
2. один файл `useLankaVM` на примитиве подписки фреймворка + `createLankaAccessTracker`;
3. `testing.ts` с `renderWithLanka` над testing-library фреймворка;
4. `_playground/` с вызовом `lankaViewBindingConformance` и адаптером;
5. `perf/<fw>.perf.md` с бенчем хука;
6. `README`/`GUIDE`/`SKILL` пакета и потребительский `skills/lanka-<fw>`;
   7a. остров в `_playgrounds/astro`, если у фреймворка есть интеграция Astro, плюс
   строка в `ASTRO_ISLAND_BINDINGS`; если интеграции нет — строка в исключениях
   рядом, чтобы отсутствие было записанным фактом, а не забытым островом;

7. `_playgrounds/<fw>` по контракту SPA и, если есть мета-фреймворк,
   `_playgrounds/<host>` по контракту HOST, оба в `hosts.mjs`;
8. § в `modules/host/GUIDE.md`, рецепт в `tools/di/GUIDE.md`.

Ни один шаг не требует правки ядра. Если потребовал — это дефект порта, и он
чинится в ядре для всех, а не обходится в привязке.

## Что сознательно НЕ делается

- **Пакет на хост** — `@lankajs/nuxt`, `@lankajs/sveltekit`: правило хостов §5,
  «a capability the host already has is not a feature». Хост получает раздел,
  рецепт и плейграунд.
- **Своя реализация стора** взамен `zustand/vanilla`: сорок строк ради удаления
  зависимости, ценой `persist`, `StateCreator` и devtools-экосистемы.
- **Расширение peer React до 18**: отдельное решение с отдельным замером.
- **Preact, Qwik, Lit, Analog**: причины в разделе «Плейграунды».
- **Идиоматичные имена по фреймворкам** (`createLankaVM` в Solid, `injectLankaVM`
  в Angular): раздел «Полка».
- **Папка `frameworks/`**: раздел «Поле `framework`».
- **Edge-рантайм для `@lankajs/host/server`**: эдж-кейс 12; ждёт стандарта.
- **Обратная совместимость `useTodoVM()` как вызываемого**: ядро не может
  импортировать из модуля, а хук в ядре — это React в ядре. Мажор и автофикс.

## Харвест

Когда план ляжет, каждый факт ниже переезжает в документ, который им владеет, и
только потом файл удаляется:

- две оси — фреймворк и хост — и чеклист хоста → `skills/hosts/SKILL.md`, новый §;
- почему `"use client"` — правило одного фреймворка → `skills/hosts/SKILL.md` §4;
- `parallel` против `interchangeable`, и почему привязка — полка, а
  `react-forms` — нет → `skills/structure/SKILL.md` 5d;
- одно имя `useLankaVM` и отвергнутая идиома по фреймворкам → `skills/parity/SKILL.md`;
- «требует React» — поле, не папка; прецедент `runtime` → `skills/structure/SKILL.md`
  5c, рядом с «a package is not a bucket»;
- форма порта — читающая половина, полное состояние в подписке, флаг трекинга на
  сторе → докблок `ILankaReadableVM`;
- ограничение «достигать стора вызовом, не захватом» и зачем → докблок
  `useLankaVM` каждой привязки, одним абзацем, и раздел 14.8 → план 15 или
  докблок `defineLankaVM`;
- одиннадцать сцен → докблок `lankaViewBindingConformance`, как восемь сцен
  валидаторов живут в своём;
- «Как добавить шестой» → `modules/bindings/README.md` полки и GUIDE «writing a binding»;
- отношение 1.77 и его разложение на трекер и рендер → `perf/core.perf.md`
  строкой и `skills/performance/SKILL.md` как пример разделения замера;
- Svelte: `createSubscriber` против store-контракта → докблок `useLankaVM` в
  `@lankajs/svelte`;
- Angular CLI и esbuild-плагины — что выяснилось в 14.7 → `tools/di/GUIDE.md`
  рецепт Angular;
- Nitro как общий раздел двух хостов → `modules/host/GUIDE.md`;
- отвергнутые фреймворки и причины → `modules/bindings/README.md` полки —
  таблицей, как таблица кандидатов в плане 13;
- почему `renderWithLanka` уехал из кита → `tools/testing/README.md` и
  changeset мажора;
- почему экземпляр VM больше не `use*` → `skills/naming/SKILL.md`.
