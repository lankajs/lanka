# @lankajs/tool-testing

## 2.0.0

### Major Changes

- d0e4474: The ViewModel is a store, and reading one from a screen is a separate package.

    `createLankaVM` and its three siblings answered a React hook: `useTodoVM()`,
    callable only inside a component. That made the framework React-only by its
    SHAPE rather than by its imports — one file in core imported React, and the
    contract imported it everywhere.

    They now answer a ViewModel: `getState()`, `subscribe()`, `setState()`, a name
    and a tracking flag. A screen reads one through its framework's binding —
    `useLankaVM(todoVM)` from `@lankajs/react`, and the same call from every later
    member of `modules/bindings/` — and a program with no framework reads
    `getState()` directly. 33 of the 34 packages here now need no UI framework at
    all, which `check-runtime.mjs` prints on every run.

    `renderWithLanka` moved from `@lankajs/tool-testing` to
    `@lankajs/react/testing`. The kit depends on `lanka` and nothing else, so it
    could not be the one package that also decided which UI framework an application
    uses.

    ## React keeps the hook

    Losing the call signature is a fact about CORE, which may not know what a hook
    is. It did not have to become a fact about React, and it has not: `@lankajs/react`
    publishes `toLankaReactVM`, which hands the same ViewModel back callable.

    ```ts
    const todoVM = createLankaVM({ … }); // framework-free, as Vue and Svelte get it
    export const useTodoVM = toLankaReactVM(todoVM); // React's own spelling
    ```

    ```tsx
    const { todos, load } = useTodoVM();
    const count = useTodoVM((state) => state.todos.length);
    const todos = useTodoVM.getState().todos; // outside a component, as always
    ```

    One store either way. The call forwards to `useLankaVM`, the object forwards to
    the ViewModel, and nothing about notification, access tracking or laziness
    differs from reading the same ViewModel in Vue — which the five bindings'
    conformance suite is what proves.

    So a React application migrates by wrapping its ViewModels once and changing
    nothing else:

    ```diff
    -export const useTodoVM = createLazyLankaVM({ … });
    +export const useTodoVM = toLankaReactVM(createLazyLankaVM({ … }));

    -import { renderWithLanka } from "@lankajs/tool-testing";
    +import { renderWithLanka } from "@lankajs/react/testing";
    ```

    `useLankaVM(todoVM)` remains the portable spelling and the one the guides teach.
    A codebase already on it needs nothing here.

    ## Names

    Every published name survives. `TLankaStatelessVMHook` and
    `TLankaSharedStoreVMHook` are `@deprecated` aliases of `ILankaReadableVM` and the
    new `ILankaSharedStoreVM` — deprecated in CORE, where the word "Hook" now
    describes nothing, and a published name is never removed. The word itself is not
    deprecated: it moved to where it is true, as `TLankaReactVMHook` in
    `@lankajs/react`.

### Minor Changes

- afadcfa: A selector meant two different things depending on which binding answered, and
  nothing asked until now.

    The conformance suite had NO scene about selectors, though all five members
    publish one. It has four now — what a selector picks, that a reader is woken when
    the SELECTION moves, that it is not woken otherwise, and that the selector arm
    releases its subscription — and they found two defects.

    **Four of the five re-rendered for every change.** React bails on an
    `Object.is`-equal snapshot because `useSyncExternalStore` does; a binding built
    on a ref or a signal SETS it on every notification, so the selector narrowed what
    was read and nothing else. Vue, Svelte, Solid and Angular now compare the
    previous selection and wake only when it moved.

    **Svelte refused a selector returning a number.** Its selected view carried the
    selection's own keys, so the overload demanded `TSelected extends object` — a
    member of the shelf narrowing the shared name. The selector arm now answers one
    value under `current`, which is Svelte's own convention for a reactive value
    (`MediaQuery` and the rest of `svelte/reactivity` read that way) and takes any
    selector.

    ## Two idioms changed shape, one is new

    **`defineLankaComposable` answers a FUNCTION**, the way Pinia's `defineStore` does:

    ```ts
    export const useTodosStore = defineLankaComposable(todosVM); // module level
    const todos = useTodosStore(); // in a component
    ```

    Measured before the change: a store built at module level opened its subscription
    at IMPORT time, outside any component scope — so nothing released it, and every
    component shared ONE recording. A component reading only `rows` re-rendered when
    `unread` moved, which is the whole of what access tracking exists to prevent.
    Each call now builds a store in the calling component's scope, with its own
    subscription and its own recording.

    **`toLankaObservable` is new in `@lankajs/angular`**: a ViewModel as something
    the `async` pipe and an RxJS chain accept. Angular is signals-first and the two
    signal spellings are the default, but it is also a framework with fifteen years
    of `Observable` in it, and a signal cannot be passed to `combineLatest`. It
    emits the current state first like a `BehaviorSubject`, gives each subscriber its
    own recording, needs no injection context — a subscriber holds its own
    unsubscribe — and imports no `rxjs`: `AsyncPipe` accepts `Subscribable<T>`, which
    is one method.

- 343ef65: All NINE ways of building a ViewModel, in every binding, in the suite and in the
  playground.

    The conformance suite drove six shapes and one stateless factory; it now drives
    every one core publishes — `createLankaVM`, `createLazyLankaVM`,
    `ALankaVM.build()`, `createSharedStoreLankaVM`, `createLazySharedStoreLankaVM`,
    `ALankaSharedStoreVM.build()`, `createStatelessLankaVM`,
    `createLazyStatelessLankaVM` and `ALankaStatelessVM.build()`. The two that were
    missing were the lazy and class STATELESS shapes, and nothing would have caught a
    binding that broke on either.

    `LANKA_VM_SHAPES` and `LANKA_STATELESS_VM_SHAPES` are published for a reason the
    suite cannot serve: a binding's own IDIOM — a callable ViewModel, a Pinia-shaped
    store, a Svelte store, a Solid store, a signal per field — is not what `mount`
    drives. Each package now loops over the same two lists in its playground, so an
    idiom is held to every shape the port is. A third-party binding author has the
    same need the day they add a spelling of their own.

    `createLankaFakeFormVM` now answers `ILankaFieldError` — a path in SEGMENTS —
    rather than a shape of its own, so a screen written against the double reads
    exactly like one written against a real validator. The React and Vue playgrounds
    dropped their private copies of that ViewModel and use it: three copies of one
    form was what `check-composition` called it.

- e62f53c: `@lankajs/svelte` and `@lankajs/solid` — the third and fourth bindings.

    ```svelte
    <script lang="ts">
    	const state = useLankaVM(todoVM);
    </script>

    {#each state.rows as row}<li>{row}</li>{/each}
    ```

    ```tsx
    const state = useLankaVM(todoVM);
    <For each={state().rows}>{(row) => <li>{row}</li>}</For>;
    ```

    The same name every member of the shelf publishes. Svelte's answers an object of
    getters, built on `createSubscriber` — so this package needs no compiler and
    builds like every other one here. Solid's answers an `Accessor`.

    `@lankajs/tool-testing` gains the two halves a binding is built from:
    `prepareLankaRender` (the live instance, the doubles, the caller's setup and the
    scenario layer, in that order) and `createLankaFakeVM` (the one ViewModel all
    four playgrounds read, so four sets of deliberately identical claims are made
    about the same thing).

- 9ae4f10: Writing a binding for a framework lanka does not ship is now a documented
  contract rather than a reading of five packages.

    `lanka/extend` publishes `createLankaViewSubscription(viewModel, onChange)` —
    the four steps every shipped binding takes, written once: subscribe, ask whether
    the change touched anything this reader READ, report the skip so the blind-spot
    diagnostic can fire, and hand back a read that records and is live. What is left
    to an author is how their framework is woken and how it says a reader has gone,
    which is the only part nobody else can know.

    ```ts
    export const useLankaVM = (viewModel) => {
    	const view = createLankaViewSubscription(viewModel, () => myFramework.invalidate());
    	myFramework.onTeardown(view.stop);

    	return view.read;
    };
    ```

    The five shipped idioms were rewritten onto it, so the abstraction is the one
    they use rather than one written for somebody else.

    `lankaViewBindingConformance` now drives EVERY shape of ViewModel — plain, lazy,
    `ALankaVM.build()`, shared-store, lazy shared-store, `ALankaSharedStoreVM.build()`
    and stateless — so a binding that only ever met the plain factory is held to the
    rest. Seven scenes, added rather than reworded, and every member of the shelf
    answers them.

    `@lankajs/tool-testing` also publishes `createLankaFakeFormVM`: a form whose two
    fields are two ROOT keys, which is what makes "re-render the input that changed
    and not its neighbour" a question a binding can be asked at all. Five copies of
    that ViewModel would have diverged on the day one of them gained a key.

    `tools/testing`'s guide now carries the whole authoring path: the port, the
    mechanism, the proof, what the scenes hold a binding to, and how far an idiom of
    its own may go.

- d11c41c: `@lankajs/vue` — the same ViewModel, read from a Vue component.

    ```vue
    <script setup lang="ts">
    const state = useLankaVM(todoVM);
    </script>

    <template>
    	<li v-for="todo in state.todos" :key="todo.id">{{ todo.title }}</li>
    </template>
    ```

    The same name `@lankajs/react` publishes, on purpose: a consumer moving a screen
    between frameworks rewrites the view and not the vocabulary. What differs is what
    the call answers — a `ShallowRef` here, the state itself in React — because that
    is the framework's own reactivity and the one thing a binding must not hide.

    `lankaViewBindingConformance` gains two things the second binding found. Its
    adapter now accepts a promise from `act` and from `renderToString`: the
    signature was synchronous because React's `act` is, and Vue's scheduler is not.
    No scene's assertion changed, which is the claim the suite exists to make.

- efaaf46: Six scenes added to the conformance suite, and three defects came out that every
  binding's own green suite had agreed with.

    The suite asked about one mount, one change and one reader. What it did not ask
    about is where the bindings differed: a selector that builds its answer, several
    changes in one turn, the actions sitting beside the state, a second reader
    leaving, a key written the value it already held, and a reader whose read set
    MOVES between renders. Those are the six, and they run for all five members.

    **React crashed on the commonest selector there is.**
    `useLankaVM(vm, (s) => ({ a: s.a }))` threw "Maximum update depth exceeded" on
    the first paint: `useSyncExternalStore` reads the snapshot during render and
    again after committing, and a fresh object never agrees with itself. The binding
    now runs a selector once per state object and holds the answer, so the two reads
    of one commit see the same reference. `useLankaShallow` is unchanged and still
    worth reaching for — it is what stops the reader waking for changes outside its
    selection — but it is no longer what stands between you and a crash.
    `skills/parity/SKILL.md` already said this belonged in `useLankaVM` rather than
    in an idiom on top of it.

    **React showed the wrong ViewModel after a swap.** A component handed a
    different ViewModel at the same mount point — an ordinary prop change — kept
    reading the first one for ever: the access tracker closes over the ViewModel it
    was built with, and it was built once per mounted component. The subscription WAS
    rebuilt, so the screen woke on the new ViewModel's changes and then re-read the
    old one's state. A live subscription and a frozen screen, with no error anywhere.

    **Vue leaked a subscription per server request.** `useLankaVM` subscribed during
    `setup`, and on a server nothing is ever unmounted — the instance's scope is
    never stopped, so `onScopeDispose` never runs. Every render left a listener on a
    module-level ViewModel for the life of the process. Inside a component the
    subscription now starts in `onMounted`, a lifecycle a server never reaches, with
    a catch-up read for a change that landed between setup and mount; outside a
    component — a module-level read, a test, a bare `effectScope` — it opens
    immediately, as before.

    That last one was invisible because the scene that asks it was being SKIPPED,
    for a reason that had stopped being true: the suite takes a promise from
    `renderToString` and has since the second binding was written. `@lankajs/vue`
    answers it now. `@lankajs/solid`, `@lankajs/svelte` and `@lankajs/angular` still
    skip it and now say why, in the adapter, beside the skip.

    `lanka/extend`'s own `createLankaViewSubscription` — advertised as the whole of a
    view binding minus the framework — is run through the suite too. It had one
    caller in the repository and no claim on the shelf's bar, which is the first
    thing a promise a consumer is invited to build on loses.

    ## One thing the port promised without saying so

    `ILankaReadableVM.getState()` answers the SAME object until something changes,
    and every binding holds something against that identity — the access tracker
    caches its recording proxy by it, and React now holds a selector's answer the
    same way. Six factories keep the property and the interface never mentioned it,
    so a consumer's own implementation that composed a fresh object per call would
    reintroduce the React crash in code that looked correct in the other four. It is
    written on the interface now.

    `createLankaViewSubscription`'s first line called itself "the whole of what a
    view binding is, minus the framework". It is the TRACKED half — every shipped
    member also has a selector arm it deliberately does not serve — and it says so.

### Patch Changes

- Updated dependencies [4178c0c]
- Updated dependencies [8349d0b]
- Updated dependencies [9ae4f10]
- Updated dependencies [d0e4474]
- Updated dependencies [912c1c1]
- Updated dependencies [efaaf46]
    - lanka@2.0.0

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
