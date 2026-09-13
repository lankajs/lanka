# @lankajs/tool-testing

## 1.2.0

### Minor Changes

- 252a40f: The storage port moves into core, and gains a suite that can fail

    `ILankaStorageAdapter` and its two halves are now declared in `lanka/storage` —
    types only, zero runtime, called by nothing inside core, exactly as `lanka/cache`
    is. `@lankajs/storage` re-exports all three names, so an application importing
    them from there keeps working and always will.

    **Why the port moved, when the module owns every implementation.** A family of
    adapters promises interchangeability, and the only honest way to check that
    promise is a shared conformance suite — which lives in `@lankajs/tool-testing`.
    The kit depends on `lanka` and on nothing else, and its own notes said so: a
    double over a MODULE's port would invert the direction the whole repository
    points. So the suite was impossible while the port sat in a module, and a family
    with no suite is packages promising interchangeability with nothing checking it.

    The alternative — amending the structure canon from "the same core port" to "the
    same port" — was rejected. It would have been one sentence instead of a
    subsystem, but the kit's objection is not about the canon's wording and no
    wording fixes it.

    **`@lankajs/tool-testing` gains `lankaStorageAdapterConformance`**: ten clauses
    as DATA, so the suite's own spec can point each scene at an adapter that is
    broken on purpose and assert that the scene fails. Twelve such adapters are in
    that spec, and every one of them is a bug somebody has shipped — an engine that
    parses JSON on the way out, a `clear` that empties its key index and leaves the
    values, a ceiling that truncates instead of refusing. It also gains
    `createLankaFakeStorageAdapter`, the port's second implementation: an interface
    with one implementation is not an abstraction.

    **One clause is deliberately the opposite of the read cache's.** `cancel` on
    `ILankaReadCache` is optional because three of four libraries could not do it,
    and a cache that cannot cancel merely finishes a request nobody wants. `clear()`
    stays REQUIRED here, because a store that cannot clear ends a session with the
    tokens still in it — waste versus the failure itself. An engine that can neither
    enumerate nor wipe, which is `expo-secure-store`, keeps its own index instead;
    the cost lands on the one adapter with the problem rather than on every caller.

    **What the suite found when it was pointed at what already exists.** No broken
    clause: `LankaWebStorageAdapter`, `LankaCacheStorageAdapter` and the playground's
    own memory adapter pass all ten. Two wrong documents: `LankaIndexedDbAdapter`
    does not bind this port at all — it holds `Blob`s for `@lankajs/blob-cache`,
    which its own file header states in its first paragraph — while its class
    docblock and the package README both called it a third handler of the same port.
    Both now say what the code does. Nothing moved in the code.

- 0453484: The validator family: five new packages, and three defects the mixing found

    `modules/validators/` is now a family — one package per schema library, all
    binding `ILankaValidator` — and it gained five members.

    **`@lankajs/yup` is the one that is not optional.** yup implements Standard
    Schema, but its `~standard.validate` is declared `async` and returns a promise
    for every schema, so core's synchronous port refused **every yup schema in
    existence**. The package bridges `validateSync(value, { abortEarly: false })`.

    **`@lankajs/typebox`** bridges the one library that publishes no Standard Schema
    at all, over a `TypeCompiler` checker cached per schema — compiling per call
    would have made it the slowest package in the family while claiming the fastest.

    **`@lankajs/effect`** holds still the Standard Schema wrapper Effect builds anew
    on every call. **`@lankajs/arktype`** is core's port under a vendor's name, like
    valibot.

    **`@lankajs/any-schema`** is for the application that ended up with two schema
    libraries — a merger, a vendored SDK, a screen older than the decision. It routes
    by dialect, takes custom dialects for libraries lanka has never heard of, and
    carries `createLankaSchema` for a shape with no library behind it at all. It is
    not the recommended way to use lanka, and says so first.

    Three defects, each found by a test rather than by reading:

    - **`lanka`** — `readIssuePath` used `Array.prototype.map`, which preserves an
      Array subclass. arktype returns a `ReadonlyPath` carrying a cache, so
      `ILankaFieldError.path` came back with a library internal attached: it printed
      identically to a plain array and compared unequal.
    - **`lanka`** — the port read `schema["~standard"]` unguarded, so a schema from
      another library produced "Cannot read properties of undefined". It refuses by
      name now, and its async refusal names `@lankajs/yup`.
    - **`@lankajs/zod`** — its Standard Schema guard required `typeof schema ===
"object"`, and an arktype schema is a FUNCTION. Every arktype schema went to
      the zod 3 bridge and died on `schema.safeParse is not a function`.

    All six vendor validators now refuse a schema from another library with a
    `LankaValidationError` naming the mismatch. Before this, five of the six threw a
    raw `TypeError` out of `validateSafe` — a method that promises to throw nothing
    the data caused.

    **`@lankajs/tool-testing`** gains `lankaValidatorConformance`: the assertions
    every validator package's playground must pass, so the family's promise is one
    checked contract rather than six copies of a test file.

    `lanka/internal` gains two primitives the tier exists for — a sibling package
    needs them and must not reach into core's `src/`. `lankaValueOrThrow` is the
    strict path built from the safe one, generic so each package keeps its own
    inference; `lankaForeignSchemaMessage` is the sentence three packages have to say
    identically when handed a schema from another library. A facade
    `isStandardSchema` was proposed for the same duplication and refused: it would
    answer `true` for every yup schema while `lankaStandardValidator` throws on every
    yup schema, so the name would have told a consumer the exact wrong thing.

- 937cf2f: The read-cache family: a port in core, a suite that can fail, and the two libraries that can bind it

    `lanka/cache` publishes `ILankaReadCache` and no cache. A host framework carries
    a request cache and its revalidation, so the framework ships none — two of them
    disagree on the first mutation. Where there is no host, a plain Vite SPA, the
    slot is EMPTY rather than taken: two screens reading one resource send two
    requests and grow two independently ageing copies. Core declares the shape and
    calls it from nowhere.

    **The port's docblock is the contract**, because behaviour is where two honest
    implementations diverge and signatures are not. Twelve clauses; four of them
    cannot be checked from inside an implementation and are stated for whoever wires
    one. The two that cost the most to discover: `subscribe` must NOT deliver the
    current value, and `invalidate` must refetch only while somebody is listening.

    **`@lankajs/tool-testing/lankaReadCacheConformance`** makes that executable. The
    scenes are DATA, so the suite's own spec points each one at a deliberately broken
    cache and asserts it is REFUSED — a suite that only ever passes real
    implementations proves that it agrees with them, not that it checks them. An
    application binding a cache this repository never heard of runs the same list.

    **`@lankajs/tanstack-query`** is the recommended member and implements all seven
    operations. Three of its lines carry knowledge that is wrong silently, and each
    has a test that fails when written the obvious way: `refetchType` chosen by
    subscriber count, `event.query.queryHash` rather than a locally built one, and
    filtering on `event.action.type` as well as `event.type`.

    **`@lankajs/nanostores-query`** implements six and declares no `cancel`, because
    `@nanostores/query` hands its fetcher only key parts and no signal. **That is why
    `cancel` is OPTIONAL on the port**: a cache that cannot cancel finishes a request
    nobody wants, which is wasteful and never wrong, while declaring it as a no-op
    would tell a caller the request stopped. Writing this member found four more
    facts no reading would have — `subscribe` fires immediately where `listen` does
    not, attaching MOUNTS a store so an unconditional attach looks watched forever,
    key parts are joined with nothing so a store must be addressed by `store.key`,
    and a failure is remembered so a failed read has to drop the store.

    **Why only two.** Apollo, urql and RTK Query are a transport AND a cache, so they
    replace a layer rather than adapt to one — lanka already has a gateway layer.
    SWR's public surface has no cache subscription and no cancellation at all. The
    measurement is in `skills/hosts/SKILL.md`, so the next reader sees the reasons
    rather than asking again. `@nanostores/query` is named as the candidate whose
    one missing operation could come back: a signal reaching its fetcher reopens it.

### Patch Changes

- 791d2cb: `renderWithLanka` brings the scenario layer up, as it said it did

    The helper's own docblock said it rendered "with a bootstrapped framework". It
    awaited `lanka.bootstrap()` and never called `lankaScenarioBootstrap.bootstrap()`,
    which is what BINDS a ViewModel's `scenarioHandlers`.

    So every scene testing a scenario handler rendered a component whose handlers
    were never attached — and the assertion that the screen did not change passed for
    the wrong reason. Nothing threw and nothing warned. The only way to notice was a
    test asserting "the fact arrived and the screen updated", which is exactly the
    test nobody writes against a helper they trust.

    Bootstrap runs after `setup?.(lanka)`, not before: `setup` is where a scene
    registers its ViewModels and doubles, and binding happens against what exists
    when it runs. Called first it would bind an empty registry — the same bug with
    the order reversed.

    **Worth re-reading your scenes after upgrading.** A scene that passed while its
    handlers were inert may now genuinely exercise them, and that is the point.

- Updated dependencies [937cf2f]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [791d2cb]
- Updated dependencies [252a40f]
- Updated dependencies [937cf2f]
- Updated dependencies [0453484]
- Updated dependencies [937cf2f]
    - lanka@1.3.0

## 1.1.0

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

## 1.0.1

### Patch Changes

- `@lanka_di/*` stays external in the bundle, which is what makes an installed package wirable at all.

    `1.0.0` shipped with those specifiers resolved at build time, so the repository's own empty fixture went into `dist`: an installed `lanka` resolved every gateway, scenario and singleton against `{}`, threw `not found` for all of them, and the consumer's `@lanka_di` alias had nothing left to attach to. Verified against the published tarball — `dist/index.js` contained no `@lanka_di` import at all. Left external, the specifier survives into `dist` and the `.d.ts`, and the consumer's bundler alias and `tsconfig` paths answer it.

    Four fixes ride along, each with the test that names it:

    - `register()` was honoured by two locators out of four, so a registration against the other two was accepted and ignored.
    - A lazy hook advertised `then`, which made it look like a promise to anything that duck-types one — `await` on a hook returned the hook.
    - A stopped event was still replayed to a later subscriber, because the buffer filled before the chain could refuse it.
    - `resolvePath` stripped a leading slash it had already returned for, and `findExportedClass` resolved names a barrel never exported.

    Only the packages whose published output actually changes are versioned here: the externalisation is declared for all nineteen, but the other fourteen never import `@lanka_di` and their bundles are byte-identical.

- Updated dependencies
    - lanka@1.0.1

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
