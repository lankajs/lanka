# lanka

## 2.2.1

### Patch Changes

- 9f41d9f: A consumer's singleton no longer meets an undefined `ALankaSingleton` when `lanka/locator` is the first lanka import.

    `Class extends value undefined is not a constructor or null`, thrown from the
    consumer's own `Singletons.ts` — on node, and under vitest in any spec that
    imports a singleton module directly. An application whose first import is
    `lanka` never saw it, and neither did the tarball probe, which imported `lanka`
    first too.

    ## What happened

    The facades `lankaSingletons` and `lankaSharedStores` re-exported their locator
    classes for `lanka/extend` to publish. That put `LankaSingletonLocator` — the one
    module that reads `@lanka_di/Singletons` — behind the `lanka/locator` entry, the
    entry whose body defines `ALankaSingleton`. esbuild hoists every chunk import
    above the body, so the barrel evaluated before `ALankaSingleton` existed. The
    1.3.0 fix ordered the exports in `locator/index.ts` so the marker came first,
    and a bundler nullifies that order: the chunk holding the reader is imported
    before any line of the body runs.

    `verify-build.mjs` §1b exists to refuse exactly this, and passed. esbuild pulls a
    chunk in for its side effects as a BARE import — `import "./chunk-X.js";` — and
    the graph reader matched only `from "…"`, so the reader was reached and never
    counted.

    ## The fix
    - **A facade imports nothing from a locator.** It reaches its locator through
      the active runtime, and `lanka/extend` publishes `LankaSingletonLocator` and
      `LankaSharedStoreLocator` from their own files. `lanka/locator` now imports
      two chunks — the proxy factory and the runtime accessor — and reaches no
      reader, whatever order esbuild gives them.
    - **§1b counts bare imports.** `scripts/built-imports.mjs` is the reader, pure
      and pinned by a spec that hands it the 2.2.0 shape: a reader behind a bare
      import.
    - **§3b runs the consumer's order.** Each of the four entries a consumer's class
      imports — `lanka/gateway`, `lanka/scenario`, `lanka/viewmodel`,
      `lanka/locator` — is imported FIRST in a node process, in front of the barrel
      whose class extends it. Pointed at the 2.2.0 layout, `lanka/locator` fails
      with the consumer's own error.

    No published name changes: `lanka/extend` still exports both locator classes,
    and every export of `lanka/locator` is where it was.

- 2e6503a: The error thrown when a call finds no lanka instance now says which of four things happened, rather than sending every reader to a `createLanka` call that may have run minutes earlier.

    Reported against an application that upgraded lanka 2.1.0 → 2.2.0 under a running
    Vite dev server: the open page kept 2.1.0, a module loaded afterwards got a fresh
    2.2.0 evaluation with no instance, and the message said "Call createLanka({ host })"
    about a page that had been rendering off one the whole time. A copy older than 2.2.0
    does not announce itself to the copy check, so nothing better could be said.

    - **Never had an instance, and no other copy has one** — the start-up message, now
      followed by what it means when `createLanka` DID run: another evaluation of lanka
      started empty, most often a dev server that kept the page open through an upgrade.
      Reload the page.
    - **Had one, and it was cleared** — new. The instance was disposed (or deactivated),
      so the call outlived it, or the next one was never created and activated.
    - **Another copy on the page has one** — the bundling advice as before, and the
      same dev-server upgrade beside it: from 2.2.0 on, the old copy announces itself
      and that case lands here.
    - **A runtime resolver answered with none** — unchanged.

    The success path of `requireActiveRuntime` is exactly what it was; the message is
    built only on the way to a throw.

## 2.2.0

### Minor Changes

- d663e27: A ViewModel can belong to a scope, and leaves the bus when the scope closes.

    A module that mounts into a page and later leaves it — a route, a modal, a
    separately built micro-frontend — builds ViewModels that subscribe to
    scenarios. Until now, leaving meant remembering `resetScenario()` for each of
    them, and the one forgotten kept running handlers against a screen that was
    gone. Scopes already gave services that lifetime; ViewModels did not have it.

    ## What changes
    - **`resolveLankaVM(definition, { scope })`** — `lanka/extend`, a new optional
      second argument, typed `ILankaResolveVMOptions`. The ViewModel resolved with a
      scope is that scope's own: one per definition in it, a different instance from
      the page's, and never adopted by a later framework instance.
    - **`scope.dispose()`** now also takes the scope's ViewModels off the bus and out
      of the registry, before it disposes the scope's services.
    - A closed scope refuses to resolve a ViewModel, as it already refused to resolve
      a service.

    A scope still takes only ITS OWN. A ViewModel joins one by being resolved in it,
    never by having been built while some callback ran — so a shared ViewModel first
    touched from inside a module survives the module.

    ## A lazy ViewModel belongs where it was resolved

    `createLazyLankaVM` and its two siblings build on their first READ, which comes
    after `resolveLankaVM` returned. That build ran outside the scope it was resolved
    in, so a lazy ViewModel resolved per request on a server was declared into the
    process-wide list every later request adopts — one request's handlers running
    against another's. A lazy ViewModel now builds under the scope it was declared
    in, whenever it is first read; and a first read after its scope closed is refused
    with the same "the scope is closed" a resolve gets.

    ## Also in this release
    - **`ILankaEventBusOutcome` carries `data` on a DELIVERED outcome**, and only
      there: a payload handed out on "stopped" would route around the middleware
      that stopped it. An observer that repeats a delivery elsewhere needs exactly
      this. `@lankajs/plugin-relay` is the first.
    - **`hasLankaScopeResolver`** is published from `lanka/internal`, the tier
      sibling packages read.

    ## What you do

    Nothing, unless a screen of yours mounts and unmounts. If one does, hold its
    ViewModel as a `defineLankaVM` definition and resolve it in the scope the screen
    lives in. `core/GUIDE.md`, "Scopes", has the four lines.

- 3d5ab6a: Two copies of `lanka` on one page are no longer silent.

    Several UI frameworks in one application are supported — a migration done
    screen by screen, modules owned by different teams, micro-frontends — over ONE
    copy of `lanka` on the page. Each copy has its own bus and its own pointer to
    the running instance, so when a separately built module bundles its own copy, a
    scenario triggered through one never reaches a ViewModel registered with the
    other. Until now nothing reported it: both halves of the page rendered, and one
    of them never updated again.

    ## What changes
    - **In development, a copy that loads onto a page where another copy is running
      warns once**, naming the fix: a singleton in Module Federation's `shared`, an
      import map, or `lanka` external in the module's build. Loading is checked, not
      only starting, because the commonest form of the accident is a bundled copy
      that is never started — the shell already did that.
    - **In development, a copy that starts while another copy runs warns once**, for
      the same reason.
    - **In any mode, `lanka used before an instance existed` now says when another
      copy on the page has one**, instead of sending the reader looking for a missing
      `startLanka`.

    Two instances of ONE copy — `createLanka`'s promised isolation — stay silent,
    and so does a production page: two copies there may be two applications kept
    apart on purpose.

    ## What you do

    Nothing, unless you see the warning. If you do and the modules are meant to
    share state, ship one `lanka`. `ARCHITECTURE.md`, "Several frameworks in one
    application", has the table for one bundle and for separate builds.

    A test double passed to `setActiveLankaRuntime` from `lanka/internal` now needs
    `getFlags()`, which `ILankaRuntime` always declared.

## 2.1.0

### Minor Changes

- 7bc171b: one name for the class style, and the lazy stateless config stops sharing a name with a type it is not

    **`toLankaCallableVM` is published by every binding.** The six factory names
    answer a callable for a ViewModel declared THROUGH them, which left a class one
    step behind: `createLankaVM(config)` was one line and `new RunVM().build()` still
    had to be wrapped by hand — and four of the five bindings published no way to
    wrap it, because their wrapper lived in `_internal/`.

    ```ts
    // a ViewModel this package did not declare: a class, a library's, or one core built
    export const useRunVM = toLankaCallableVM(new RunVM().build());
    ```

    One name in all five, so the vocabulary does not change when a screen moves
    between frameworks; what differs is what the call ANSWERS, exactly as for
    `useLankaVM` and the six factories. `toLankaReactVM` is the older spelling of the
    same function in `@lankajs/react`: still published, still correct, and new code
    may write either.

    **`TLankaLazyStatelessVMConfig` is published by `lanka/viewmodel`.** Core
    declared `TLankaStatelessVMConfig` twice — the eager factory's, which was
    published, and one local to the lazy factory, which is what that factory takes.
    Annotating a shared config with the published name and passing it to
    `createLazyStatelessLankaVM` failed to compile for a reason the published surface
    did not explain.

    The two are now two names, and the difference is written where a reader meets
    it: the lazy config is `ILankaVMConfig` without `states`, so it hands
    `createActions`, `onInit` and `onReset` the STATEFUL context — whose `set` takes
    a `replace` argument on a ViewModel with nothing to replace — and it accepts
    `enhancers` and `enableAccessTrackingOptimization`, which the stateless factory
    does not read. Narrowing it to the eager config would refuse configs that compile
    today, so the difference is named rather than removed.

    Nothing is removed and nothing changed meaning. `toLankaReactVM`,
    `TLankaStatelessVMConfig` and every other published name mean what they meant.

- 7bc171b: every binding publishes core's six ViewModel factories under core's own names, already wearing that framework's read

    Declaring a ViewModel a screen will read took two steps: core's factory, then
    that binding's conversion. Every ViewModel file in a consuming application
    carried both, and the second one was pure ceremony — it said "React" in a file
    that had already said it by importing from `@lankajs/react`.

    Each of the five bindings now publishes `createLankaVM`, `createLazyLankaVM`,
    `createStatelessLankaVM`, `createLazyStatelessLankaVM`,
    `createSharedStoreLankaVM` and `createLazySharedStoreLankaVM` — core's names,
    core's configs, core's overloads — with that framework's own `useLankaVM`
    pre-applied and the ViewModel's members forwarded onto the result. A declaration
    moves by changing its import line:

    ```ts
    // before
    import { createLankaVM } from "lanka/viewmodel";
    import { toLankaReactVM } from "@lankajs/react";

    const runVM = createLankaVM<IRunState, IRunActions>({ … });
    export const useRunVM = toLankaReactVM(runVM);

    // after
    import { createLankaVM } from "@lankajs/react";

    export const useRunVM = createLankaVM<IRunState, IRunActions>({ … });
    ```

    They are not idioms of one package: all five publish the same six, so the shelf
    stays parallel and the guide stays one guide. What differs is what the call
    ANSWERS — a plain state in React, a `ShallowRef` in Vue, an `Accessor` in Solid,
    a `Signal` in Angular, a view in Svelte — which is exactly what already differs
    about `useLankaVM`.

    `lanka/extend` gains `createLankaCallableVM`, the Proxy that makes an object a
    function and a ViewModel at once. It was written inside `@lankajs/react` and is
    in core now because all five bindings need it, and which members belong to the
    function, what `in` must answer and what a lazy ViewModel does with a symbol have
    one answer rather than five. `toLankaReactVM` is built on it and is unchanged in
    behaviour — its twenty-eight scenes pass untouched.

    `lankaViewBindingConformance` holds all five to ONE list of what these six
    promise. A binding supplies `declare` — six one-line forwards to its own
    factories — and the suite drives the same ViewModel config through every one of
    them, asserting that the answer is still the ViewModel, that there is one store,
    that a screen reads it and wakes for it, and that the three lazy factories build
    nothing at the declaration nor to answer their own name. Twenty-two scenes per
    binding, identical in all five. Two of the suite's own tests prove those scenes
    REFUSE a binding whose lazy factory is eager and one whose declaration drops the
    ViewModel, because a scene that cannot fail reports success.
    `@lankajs/tool-testing` gains `ILankaConformingVMFactories` and
    `ILankaConformanceActions` for it.

    Nothing is removed. `useLankaVM`, `toLankaReactVM`, `toLankaSvelteVM`,
    `toLankaSolidVM`, `defineLankaComposable`, `lankaVMToRefs`, `toLankaSignals` and
    `toLankaObservable` all mean what they meant, and a ViewModel declared with
    `lanka/viewmodel` still works everywhere — which is the spelling to keep when a
    server component must read it, because a binding's barrel is client-only.

## 2.0.1

### Patch Changes

- 2.0.0 could not start an application that has a scenario, and nothing here could see it.

    `Class extends value undefined is not a constructor or null`, thrown from the
    consumer's own `.lanka/Scenarios.ts`, before the first screen renders. Every
    application on 2.0.0 with a scenario class, in every framework, on both the dev
    server and the production bundle.

    ## What happened

    The framework reads the consumer's barrels — that is the inversion `@lanka_di`
    exists for — and what a barrel exports reaches BACK into the framework: a
    scenario extends `ALankaScenario`, a gateway extends `ALankaGateway`, a singleton
    is built by `createLankaSingleton`. So there is a cycle by design, and it is
    harmless on one condition: the module defining what the consumer extends finishes
    evaluating before the module that reads the barrel starts. In the SOURCE that is
    guaranteed, because the reader imports the base class.

    A bundler can take that guarantee away, and in 2.0.0 it did. esbuild's splitting
    put `LankaScenarioBootstrap` and `ALankaScenario` into one chunk; every import of
    a chunk is hoisted above its body, so `@lanka_di/Scenarios` evaluated first and
    handed the consumer's class an undefined base. 1.3.0 had the same source and
    survived only because the two happened to land in different chunks — which is not
    a property anybody chose, and it moved the moment React left core and the module
    graph changed shape.

    ## The fix, in two halves

    **Separate files.** Every module that statically imports a `@lanka_di/*` barrel
    is now a build ENTRY POINT — the one thing esbuild will not merge into a shared
    chunk. That is what node, every bundler and the production build needed, and it
    is declared in `scripts/registry.mjs` under `barrelReaders` with the reason, so
    the layout is a decision rather than an accident.

    **One reader per barrel.** Separate chunks were not enough, and the second half
    is the one that makes the cycle unreachable rather than survivable. Node resolves
    a re-export of an already-initialised binding correctly whatever order the chunks
    arrived in; vitest's module runner resolves it through a module still in flight
    and answers `undefined`. So on the first fix a test whose FIRST lanka import was
    `lanka/scenario` still met an undefined base class — esbuild had put the
    barrel-reading chunk ahead of the base class's inside that entry, and the order
    within an entry is not ours to choose.

    What is ours is whether the entry reaches a reader at all.
    `LankaScenarioBootstrap` no longer reads `@lanka_di/Scenarios`: it asks
    `LankaScenarioLocator.getDeclaredScenarioClasses()` through the runtime it
    already reaches, and the locator is the one module that reads that barrel. All
    four barrels now have exactly one reader, all four live in `locator/`, and the
    three entries a barrel's contents actually import — `lanka/scenario`,
    `lanka/gateway`, `lanka/viewmodel` — reach no barrel at all. `lanka/locator`
    does, and the one kind of class that imports IT, a singleton, is why the export
    order in `locator/index.ts` has been load-bearing since 1.x and says so.

    Nothing moves in `exports`, and no published name changes.

    ## Why no suite caught it

    Every package here resolves `src` — the playgrounds, the unit suites, the
    conformance runs — so no test in this repository has ever loaded a chunk.
    `verify-build.mjs` is the one place that installs the tarballs and imports from
    them, and its probe barrels had a real gateway and a real singleton and `export
{}` for the other two. An empty barrel has no cycle to fail.

    It now publishes a real scenario and a real shared store as well, and asserts
    that all four resolve through their locators. Pointed at the 2.0.0 layout, it
    fails with the consumer's own error.

    The second half needed a check of its own, because node is not where it shows:
    `verify-build.mjs` now also reads the built import graph and refuses any of the
    four cycle-free entries that can reach a module importing a barrel. Pointed at
    `lanka` itself — which re-exports `createLanka` and so constructs every locator
    — it names all four readers, which is how it is known to be able to fail.

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

- 4178c0c: `createLankaShallowHold` — the comparison that makes a selector mean something,
  in core where all five bindings can reach it.

    A selector narrows what a reader depends on, and a selector that BUILDS its
    answer cannot say so: `(state) => ({ a: state.a })` is never identical to its own
    previous result, every binding compares selections by identity, and the reader
    therefore wakes for every change in the ViewModel including the keys the selector
    exists to ignore.

    ```ts
    import { createLankaShallowHold } from "lanka/viewmodel";

    const hold = createLankaShallowHold<{ title: string; status: string }>();

    // in any binding on the shelf
    const view = useLankaVM(missionVM, (state) =>
    	hold({ title: state.title, status: state.status }),
    );
    ```

    ## Why it moved

    It was `useLankaShallow` in `@lankajs/react` and nowhere else, declared as a
    React idiom. An idiom is a SPELLING — `lankaVMToRefs` is meaningless without
    Vue's refs, `toLankaObservable` without RxJS — and this was a capability: it
    changes which notifications reach a reader, and it carries a policy (one level
    deep, own keys, `Object.is`) that five packages inventing separately would have
    answered five ways. `skills/parity/SKILL.md` 3c now carries the test that
    distinguishes the two: could a sibling want it? A spelling cannot be wanted by
    another framework; a capability can.

    `useLankaShallow` keeps working and did not change shape. What is left in it is
    the half that is genuinely React's: a component re-runs the hook on every render,
    so the holding has to survive a render while the SELECTOR stays the current one —
    a ref, which core cannot have. That asymmetry is also why the core name holds a
    VALUE rather than wrapping a selector: a selector-level wrapper would be rebuilt
    whenever the selector's identity moved, and an inline arrow is a new function
    every render, so the holding would reset before it ever held anything.

    The comparison's own scenes moved with it, to `core/src/viewmodel/`. React's spec
    keeps the two that are its own and cannot be asked anywhere else — that the hold
    survives a re-render, and that a selection computed from props does not go stale
    — and each of them fails when the other arrangement wins.

    One behaviour is deliberately not preserved: a selection that is legitimately
    `undefined` is now held like any other. The React version keyed "have I held
    anything yet" on the value being `undefined`, so such a selection was never
    cached. It could not be observed — `Object.is(undefined, undefined)` is true, so
    no reader woke for it — and a flag is the honest spelling either way.

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

### Patch Changes

- 8349d0b: Every binding now speaks its framework's own language, not only lanka's.

    One shared name — `useLankaVM` — is the floor. It is what lets a screen move
    between frameworks unedited, and it stays the spelling the guides teach. It is
    also not what any of these ecosystems actually type, and a package that publishes
    it and stops has handed every consumer a foreign object to learn.

    So each binding publishes, beside the shared name, the spelling its own people
    already write:

    - **React** — `toLankaReactVM(vm)` hands a ViewModel back CALLABLE, so
      `useTodoVM()`, `useTodoVM(selector)` and `useTodoVM.getState()` all work again.
      A codebase on 1.x migrates by wrapping its ViewModels once and touching no call
      site.
    - **Vue** — `defineLankaComposable(vm)` reads like Pinia: `store.rows` in the script
      and in the template, no `.value` anywhere, and `lankaVMToRefs(store)` for
      the destructuring that would otherwise lose reactivity.
    - **Svelte** — `toLankaSvelteVM(vm)` satisfies the store contract, so `$todos`
      works and `derived`, `get` and every `svelte/store` helper accept it.
    - **Solid** — `toLankaSolidVM(vm)` is read as `store.rows` with no call, the
      way Solid holds an object, and the read itself is the subscription.
    - **Angular** — `toLankaSignals(vm)` gives a signal per field and the actions as
      plain functions, which is how an Angular service exposes state.

    Each is a spelling and not a second framework: one subscription, one store, the
    same access tracking and the same skips. That is asserted rather than promised —
    every idiom has a scene proving it answers what `useLankaVM` answers over the
    same ViewModel.

    ## Two defects these found

    **A selector returning a fresh object crashed React.**
    `useLankaVM(vm, (s) => ({ a: s.a }))` is the commonest thing a React reader
    writes, and `useSyncExternalStore` saw a new object on every read and rendered
    again — "Maximum update depth exceeded", on the first paint, with a stack
    pointing at React. `useLankaShallow(selector)` holds the last selection; the
    scene that proves it drives the unwrapped version and asserts the crash.

    **A reader could go deaf before it had read anything.** The access tracker
    recorded every string key read off the state, including keys a FRAMEWORK probes
    rather than an application reads — Vue's `shallowRef` asks for `__v_isRef`, a
    promise resolution asks for `then` — and including actions, which never change.
    Either one made a reader look as though it had read something, which switched off
    the rule that a reader who has read nothing hears about everything. The recording
    now takes only the state's own non-function keys.

    That is a fix, not a narrowing: a reader hears about MORE than before, never
    less, and a change to a key nobody read is still skipped.

    ## The canon behind it

    `skills/parity/SKILL.md` 3c now says what a binding owes its framework, and how
    far an idiom may go: no second store, nothing a conformance scene asserts
    changed, and a dependency only as a last resort. `scripts/registry.mjs` declares
    each member's idioms with the reason, and `check-family` refuses an undeclared
    extra as well as a declaration whose export is gone.

- 912c1c1: `lanka-packages` routes to every package, not to fourteen of them

    The skill an agent loads first to choose a package stopped at `@lankajs/plugin-sse`.
    Shipped and unroutable: `plugin-websocket`, `plugin-graphql`, `plugin-grpc`,
    `@lankajs/host`, both read caches, the four storage engines, five of the seven
    validators and `@lankajs/tool-skills`. An agent reading the table to answer "the
    wire has to carry traffic both ways" would have concluded the framework has no
    answer and written the socket by hand.

    Three tables now instead of one — what a module does, what goes on the wire, what
    a family asks you to choose between — plus the recommended member of each family
    and the one reason to take another. `@lankajs/storage` is named as the family a
    browser application skips entirely.

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
