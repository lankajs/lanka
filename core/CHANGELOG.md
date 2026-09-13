# lanka

## 1.3.0

### Minor Changes

- 937cf2f: A failure carries the address of the input it belongs to

    `issues` flattens the path into the text — `items.1.qty: only 2 left` — which is
    a banner's shape and useless to a form, which has a place per input and must find
    it. `plugin-http`'s `lankaMessageFromFieldErrors` already said so in its own
    comment: showing them all is a form's job. The canon reached the form's edge and
    stopped there.

    **`ILankaFieldError` is the carrier, and the path is SEGMENTS.** React Hook Form
    spells `items.1.qty`, TanStack Form spells `items[1].qty`, and neither survives a
    round trip through a string — a message may hold a colon, a key may hold a dot.
    An EMPTY path is the value as a whole, which is the form's root and not an input
    named `""`. `code` is what an application translates by.

    `LankaError.fields` and `LankaValidationError`'s third parameter are ADDITIVE;
    `issues` is untouched. `readLankaFieldErrors` answers one frozen empty list
    rather than `undefined`, so a ViewModel writes no branch for "no fields".

    **`@lankajs/plugin-http` reads the other half of a 422.**
    `lankaFieldsFromErrorMap` turns `{ errors: { "items.1.qty": ["only 2 left"] } }`
    into addressed failures and `extractFieldErrors` puts them on `LankaError.fields`.
    Not variants of one reader: a 422 usually deserves both answers at once — a
    banner and a place per input.

    All three extractors are hardened for the same reason: one that throws now
    answers nothing rather than replacing the server's words with the failure of the
    failure report.

- 791d2cb: A scenario reset can forget declarations, so a suite can isolate a ViewModel

    `lankaScenarioBootstrap.reset()` exists for test isolation and did not provide
    it. It cleared subscriptions, the scenario registry and the bus — but not which
    ViewModels had been DECLARED, and nothing else un-declares one. So the next
    `bootstrap()` re-adopted every ViewModel ever built in the process, and a
    finished test's ViewModel heard the next test's facts, running its handlers
    against the double THAT test had created.

    The symptom never reads as a stale subscriber. It is one extra call on somebody
    else's mock, or a rejection surfacing inside a test that had already passed.

    ```ts
    beforeEach(() => {
    	lankaScenarioBootstrap.reset({ withDeclarations: true });
    });
    ```

    **Opt-in, and that is the design rather than caution.** The default is what an
    APPLICATION needs and it is load-bearing: a module-level ViewModel is built once
    per process, so the declaration is the only thing that lets a second instance
    find it. Clearing it by default would bind its handlers to nothing for the rest
    of the process, silently — the exact failure the list exists to prevent. A suite
    whose ViewModels all live at module level should keep the default.

    Forgetting is not a tombstone: a ViewModel declared again afterwards is adopted
    again.

    `ILankaScenarioResetConfig` is added to `lanka/scenario`. Nothing is removed and
    `reset()` keeps its no-argument call.

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

- 791d2cb: The event bus catches a handler's rejection, not only its throw

    `dispatch` wrapped each subscriber call in try/catch so one broken handler could
    not take a dispatch down with it. That promise held only for the handlers that
    happened to be synchronous.

    A handler is typed `(data) => void`. TypeScript assigns a `Promise<void>` to a
    void return position, so `async () => { await refetch(); }` compiles with nothing
    to warn about — and "refetch when the stream reconnects" is the ordinary shape of
    a scenario handler, not an exotic one. Its rejection settles a microtask after
    the loop has finished, where the catch cannot reach it. On node's default an
    unhandled rejection ends the PROCESS, and ends it inside whatever code ran next,
    so the stack names a file with no connection to the handler that failed.

    The returned value is now checked for a `then` and its rejection written to the
    scenario log, through the same line a synchronous throw takes. Duck-typed rather
    than `instanceof Promise`: the promise need not be this realm's — a jsdom test, a
    native module and a bundled polyfill each bring their own — and `instanceof`
    would answer false in precisely the environments most likely to need it.

    **What the bus deliberately does not do is decide what the failure meant.** A log
    line is a diagnostic, not a retry and not a message on a screen. An action called
    from a handler still has to own its own failure, because the handler returns
    `void` and has nowhere to put one.

- 791d2cb: A server can construct a lanka instance: the locator's export order, and adoption that waits

    Two defects that only appear together, and only on a server. Either one alone
    made `@lankajs/host` unusable there, and both were invisible in a browser.

    **The barrel exported the facade before the marker it needs.** `lanka/locator`
    listed `lankaSingletons` ahead of `ALankaSingleton` and `createLankaSingleton`.
    The facade reads `@lanka_di/Singletons` — an application's barrel — and that
    barrel declares classes extending `ALankaSingleton`. So whoever imported the
    locator first evaluated the facade, which evaluated the application's barrel,
    which reached for a base class this module had not defined yet: `TypeError: Class
extends value undefined`, from a file the application never wrote. A bundler
    hides it exactly as often as it does not.

    The order is now marker, factory, facade, with a guard in core's own surface spec
    — an export list is a thing people reorder alphabetically while tidying.

    **`createLanka` adopted its declared ViewModels immediately.** Adoption needs an
    active runtime. Under `setLankaRuntimeResolver` there is none until a request is
    in flight, and `createLanka` IS what a request runs to make one — so constructing
    an instance threw about a missing request scope from inside the call that was
    creating it.

    Adoption now returns early when no runtime is active, and `bootstrap()` runs it
    again. Skipping outright would have been no fix: a ViewModel declared at module
    level before the instance existed would simply never bind, silently.

    Found by starting `@lankajs/host` under a resolver for the first time.

- 937cf2f: A ViewModel declaring onInit or onReset is registered with bootstrap, so its hooks run

    `onInit` runs inside `initializeScenario`, which only bootstrap calls on the
    ViewModels registered with it — and registration followed scenario bindings
    alone. A ViewModel with a hook and no `scenarioHandlers` was never initialised,
    silently, and the red test said it plainly: `registerViewModel` called 0 times.

    The binder now decides `needsBootstrap` once for all three families, from
    bindings OR a declared hook. Each base reads its hooks through
    `toLifecycleHooks()`, a protected member reporting only OVERRIDDEN ones, and the
    functional bridges declare theirs as own properties — so `this.onInit()` means
    the same thing in both styles.

    **Consequence worth knowing:** `onReset` now fires on instance disposal for
    hook-only ViewModels too, including `resetLanka()` between tests.

    No published name changed: the new promise is a protected member.

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

## 1.2.0

### Minor Changes

- c1896b7: `scenarioHandlers` accepts a factory, so a ViewModel declared at module level can
  name its scenarios through the locator without reading it at import time.

    A binding entry names its scenario, and an application names one as
    `lankaScenarios.<name>` — a locator read. Written as an array literal in a module
    body it happens while that module is EVALUATED, and a module body can run before
    `createLanka` has: the locator then refuses with "lanka used before an instance
    existed" and nothing renders.

    Import order is not a defence. It holds inside one chunk, and a bundler decides
    chunks — in ES modules the body of an imported chunk runs before the body of the
    chunk importing it. Measured in a real application: 44 of its chunks were
    statically imported by the entry, its ViewModels among them, so they evaluated
    ahead of its own `createLanka` call and its whole browser-level suite died on the
    first. Every unit test passed throughout, because a test runner evaluates modules
    one at a time and never builds a chunk graph.

    `gateways` and `services` have taken a factory for this exact reason since
    `resolveLankaDependency` was written. Bindings were the field left out, and they
    are the field that reads the locator most.

    The array form is unchanged and still eager, in all three ViewModel families and
    in both styles: a factory is read at bind time by the binder, and its presence
    alone counts as "this ViewModel has scenarios" — counting them would be the very
    read the form postpones.

## 1.1.1

### Patch Changes

- 661c1f7: `LankaValidationError` is a `LankaError` of kind `schema`. The validation port's failure extended `Error` directly, so `LankaError.is` — and everything built on it: the HTTP policy's error middleware, an application branching on `kind` — never saw a refused body, while the request layer's own "200 that was not JSON" was a `schema` failure. `name` stays `LankaValidationError`, `status` stays 422, `errors` is still the message list; the described issues are also on `issues`.

## 1.1.0

### Minor Changes

- 3331c47: Four promises the code did not keep, each pinned by a test that failed before the fix.

    **`lanka`**

    - `IALankaGatewayConfig.validationService` was accepted and read by nothing: a
      gateway handed a test double got the real validator. It is now
      `this.validationService` on `ALankaGateway` and `validationService` in the
      functional context, defaulting to `lankaStandardValidator`.
    - `ILankaScenario.cleanup` is "called when the scenario is removed from the
      registry". It was never called. `unregister` and `clear` — and with them
      `dispose()` — now run it, containing what it throws.
    - `bootstrap()` is idempotent while a bootstrap is still IN FLIGHT: two callers
      arriving before the first plan finished used to run every service twice.
    - The scenario self-registration pool no longer grows by the whole barrel on
      every bootstrap and on every failed locator lookup.

    **`@lankajs/plugin-http`**

    - The CSRF header is sent only to the application's own origins — the API's,
      the page's, and any named in the new `csrf.origins`. A gateway writing the
      whole URL of a third party used to carry the token there.

    **`@lankajs/browser`**

    - `lankaCookies.set` over the Cookie Store API turned a `Date` expiry into a
      timestamp and then multiplied that timestamp as a number of days.
    - A foreign cookie with a stray `%` in its value no longer makes every
      `get`, `getAll` and `watch` throw `URIError`.

    **`@lankajs/plugin-sse`**

    - Subscribing again to an event type that was dropped no longer attaches a
      second listener to the same connection, so handlers stop firing twice.

- 3331c47: Three more ways a change arrives: a WebSocket, GraphQL subscriptions, a gRPC
  server stream — each shaped the way SSE already was.

    **`lanka`** gains the `lanka/stream` subsystem: the protocol-free half of
    realtime, which every one of the four transports needs and none of them owns.
    `ILankaServerEventTransport` (the port), `ALankaStreamBridge` and
    `createLankaStreamBridge` (a wire event → a scenario, both styles),
    `createLankaStreamTriggerContext` (the "came from outside" marker),
    `ALankaStreamTransport` (dispatch plus the reconnect ladder — a subclass writes
    `open` and `close`) and `lankaStream` (bridges attached, lifetime owned,
    teardown in the order that matters).

    It is in core because that is where both callers already look, and it is shared
    rather than copied because the marker is the piece whose failure is silent.

    **`@lankajs/plugin-websocket`** — `LankaWebSocketTransport` behind the same port
    `lankaSse` takes, so a proxy that strips `text/event-stream` costs one line of
    configuration. Plus the half SSE has not got: `send`, an outbox bounded and
    flushed on open, and a heartbeat that turns a half-open socket into a reconnect.

    **`@lankajs/plugin-graphql`** — `LankaGraphqlRequest`, whose whole reason is
    that GraphQL answers `200 OK` with an `errors` array: it becomes `LankaError`
    with `kind: "domain"`, while a partial result stays a success.
    `ALankaGraphqlGateway` / `createLankaGraphqlGateway` for `query` and `mutate`,
    and `LankaGraphqlSubscriptionTransport` speaking `graphql-transport-ws`.

    **`@lankajs/plugin-grpc`** — gRPC-Web framing, the trailers block, and sixteen
    status codes mapped onto five failure kinds, with the message codec left to
    whatever generated the message types. `ALankaGrpcGateway` for unary calls and
    `LankaGrpcStreamTransport` for a server stream read as named events.

    **`@lankajs/plugin-sse`** publishes exactly the names it always did — its `api/`
    report is byte-identical — and now re-exports the shared half from
    `lanka/stream` instead of declaring its own.

    **`@lankajs/tool-eslint`** — `lanka/layer-style` learns three role keys:
    `stream-bridge` (which accepts the old `sse-bridge` names as the same pair),
    `graphql-gateway` and `grpc-gateway`.

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

- 3331c47: Four more promises the code did not keep. Each is pinned by a test that fails on
  the old code and passes on the new.

    ## `@lankajs/storage` — major, and why

    **The storage key hash is keyed by the secret.** `LankaCipher` hashes a key NAME
    because the name says what is stored under it. The hash was a plain SHA-256, and
    a plain hash of a short predictable word is not a disguise — it is a lookup. The
    dozen names an application actually uses fit in a dictionary anybody can build in
    a second, and the common ones (`token`, `session`, `user`) are in published
    rainbow tables already. `LankaEncryptor.hashKey` is now HMAC-SHA-256 keyed by the
    secret, so the table has to be rebuilt by somebody who already has the secret —
    and somebody who has the secret can read the values anyway.

    **`clear()` removes what the cipher wrote, not the whole page.** It called the
    adapter's own `clear()`, which for `localStorage` empties everything: the theme,
    the language, the consent record, another library's data, and
    `@lankajs/browser`'s release-guard version — so the next visit dropped every
    cache as well. Entries now sit under a namespace and only those are removed. A
    store that cannot list its keys (Cache Storage) still gets the old call, which
    there means its own named cache and is already scoped.

    `ILankaAsyncStorageAdapter` gains an OPTIONAL `keys()`, which is what makes the
    scoped clear possible; `LankaWebStorageAdapter` implements it. An adapter a
    consumer already wrote keeps compiling.

    **Nothing you read is lost.** An entry written under the previous scheme is
    carried over on the first read of that key — rewritten under the new name, the
    old copy removed — and `clear()` sweeps the old shape as well. It is a major
    because the on-disk format changed and a downgrade would not find the data, not
    because a correct call breaks.

    ## `@lankajs/browser` — major

    **`get` is the inverse of `set` again.** `set` takes `string | object` and writes
    JSON for the object and the string itself for the string. `get` JSON-parsed
    whatever it found, so a string that looks like a number came back as one:
    `"1234567890123456789"` returned with its last digits rounded away, `"true"`
    returned a boolean, and `"null"` returned `null` — which `get` uses for "no such
    cookie", so `has()` reported an existing cookie as absent. Only a leading `{` or
    `[` is parsed now, because those are the only shapes `set` ever writes. The
    signature `get<T = string>` finally tells the truth.

    Major because a consumer relying on the numeric auto-parse gets a string.

    ## `lanka` — patch

    **`getEventLogs()` returns records in the order the bus saw them.** They are kept
    per event TYPE, and the no-type call concatenated those lists — so `limit` took
    the tail of whichever type the registry held last rather than the most recent
    events. A debugging tool that reorders the evidence sends the reader after the
    wrong cause. `ILankaEventLog` gains an optional `sequence`, which is what the
    sort uses: a timestamp has millisecond resolution and a burst dispatches many
    events inside one.

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
