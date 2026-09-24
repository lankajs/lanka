# @lankajs/plugin-devtools

## 6.1.0

### Minor Changes

- 75fc199: The inspector runs anywhere lanka does — and refuses a server's request scope
  when enabled.

    Only the panel needs a document. Its two DOM touches are now guarded in their own
    files — the panel view says it needs a DOM instead of failing on its first
    element, and a redraw falls back to the next tick where a document has no
    animation frames — so the package is declared for Node and React Native as well
    as the browser. The plugin, the collector, `subscribe` and `getSnapshot` work in
    a Node script, a test or on a device; `renderLankaDevtoolsPanel` still returns
    `undefined` without a document.

    **One behaviour change.** Installing an ENABLED inspector where a scope resolver
    is installed — `@lankajs/host/server` — now throws. Its logger sink is the
    process's, and on a server it collected every concurrent request's log lines into
    one request's history. A disabled inspector, which is what a production build
    ships, still installs and collects nothing. If you enabled it in server code, pass
    `{ enabled: false }` there.

## 6.0.0

### Patch Changes

- Updated dependencies [7bc171b]
- Updated dependencies [7bc171b]
    - lanka@2.1.0

## 5.0.0

### Patch Changes

- Updated dependencies [4178c0c]
- Updated dependencies [8349d0b]
- Updated dependencies [9ae4f10]
- Updated dependencies [d0e4474]
- Updated dependencies [912c1c1]
- Updated dependencies [efaaf46]
    - lanka@2.0.0

## 4.0.0

### Patch Changes

- Updated dependencies [937cf2f]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [252a40f]
- Updated dependencies [937cf2f]
- Updated dependencies [0453484]
- Updated dependencies [937cf2f]
    - lanka@1.3.0

## 3.0.0

### Patch Changes

- Updated dependencies [c1896b7]
    - lanka@1.2.0

## 2.0.0

### Minor Changes

- 3331c47: What a consumer can test, and what a developer can see.

    **`@lankajs/tool-testing`**

    - `createLankaFakeTransport` answers per endpoint. `routes` takes a substring, a
      pattern or a predicate over `(endpoint, options)`; `times` exhausts a route so
      the next one answers, which is how "failed once, then succeeded" is written;
      `delayMs` is how a loading state is asserted. Nothing matching falls through to
      the config's own `body` / `status` / `failWith`, so every existing call behaves
      exactly as it did. `callsTo(match)` filters the recorded calls the same way.
    - `createLankaEventRecorder` records what crossed the bus and answers the
      question the scenario layer exists for: did doing this make that fire. `of`,
      `count`, `all`, and a `waitFor` that REJECTS on its deadline naming the event —
      and resolves immediately for one that already crossed, because waiting for
      something that has happened is the classic race.
    - `createLankaLogRecorder` asserts what the framework DECIDED rather than how it
      printed it. It turns the log on, because a recorder that only added a sink
      would answer an empty array and the test would pass having proved nothing;
      `stop()` puts every flag back, and `console: "silence"` keeps the run quiet.
    - `waitForLankaIdle` returns when nothing is on the wire and the work it started
      has settled, and rejects naming how many requests are outstanding. It replaces
      `await new Promise((r) => setTimeout(r, 0))`, which drains one turn and works
      until the chain behind the request grows a link.
    - `registerLankaFakes(lanka, fakes)` and `renderWithLanka({ fakes })` say which
      double stands for which name across all four locators. Doubles need not extend
      any base — that they do not is what makes them cheap.
    - `createLankaFakeScenario` remembers what it carried, in `emitted`.

    **`lanka`**

    - `lankaEventBus.addObserver` — the sixth extension point. An observer is told
      what became of each dispatch (`delivered`, `stopped` by whom, or `invalid` by
      the event's own schema) after the whole chain has run, and cannot decide
      anything. It exists because a middleware sees only the chain ahead of itself
      and a diagnostic tool's is registered first: "which middleware stopped this"
      was a question nothing could answer. The unobserved path is guarded by an
      empty-list check, so a bus nobody watches pays a length comparison.

    **`@lankajs/plugin-devtools`**

    - `stoppedBy` is filled for the first time. It was in the type, in the snapshot
      and in the guide, and no code path could ever set it.
    - The snapshot gains `requests` (endpoint, duration, whether it arrived, timed
      through `useRequestMiddleware` and rethrown untouched), `scenarios` (the
      register, so "nobody is listening" and "it never fired" are visible at all),
      and `outcome` on every event.
    - `subscribe` replaces polling, coalesced to one call per microtask; `clear`
      empties the history; `exposeAs` puts the inspector on `globalThis` under a name
      of your choosing, in development only and removed on teardown.
    - The panel grew four tabs, a filter, copy-as-JSON, clear and a collapse. It
      redraws on `subscribe` when you pass it and still polls when you do not, and
      `renderLankaDevtoolsPanel(getSnapshot, container)` keeps working unchanged.

### Patch Changes

- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
- Updated dependencies [3331c47]
    - lanka@1.1.0

## 1.0.0

### Major Changes

- The first release: nineteen packages, one framework.

    `lanka` is the core — bootstrap, config, role, locator, gateway, validation,
    mock, errors, scenario, viewmodel and logger. Nine `@lankajs/*` modules an
    application installs one at a time, five plugins that occupy a declared extension
    point, and four tools that run before runtime: the `@lanka_di` alias for six
    bundlers, the boundary lint rules, the test kit and the skill installer.

    The one rule everything follows from is checked rather than agreed: imports go
    one way, and `@lankajs/tool-eslint` names the file and the line when they do not.
    What every package promises is written down in `api/`, and from this version a
    name there is kept until a major.

    `1.0.0` rather than `0.1.0` says the five extension points have settled: request
    middleware, the in-flight counter, bus middleware, logger sinks, and `use()`
    itself. Three plugins occupy them between them, which is what made the shapes
    answerable rather than imagined.

### Patch Changes

- Updated dependencies
    - lanka@1.0.0
