# @lankajs/react

## 0.2.1

### Patch Changes

- 2c7c70b: The bindings are declared for Node.

    Vue, Svelte, Solid and Angular's bindings said "browser" and React's said
    "browser, React Native" — while Next, Nuxt, SvelteKit and Angular's and Solid's
    server renders run every one of them in Node, and this repository's own HOST
    applications do exactly that. No code changed: a binding's entries touch
    nothing a server lacks, which is why `check-runtime` accepts the wider
    declaration. What changes is what the package README and `COMPATIBILITY.md` tell
    you — a binding no longer appears among the packages to keep out of server code.

    A React Server Component still may not import `@lankajs/react`; that is what its
    `"use client"` boundary is for, and it is unchanged.

## 0.2.0

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

### Patch Changes

- Updated dependencies [7bc171b]
- Updated dependencies [7bc171b]
    - lanka@2.1.0

## 0.1.1

### Patch Changes

- 75fbbba: `@lankajs/<framework>/testing` shipped a copy of its testing library, and React's
  copy did not run.

    `import { renderWithLanka } from "@lankajs/react/testing"` — the line the 2.0
    migration asks every React consumer to write — threw
    `Error: Dynamic require of "react" is not supported` from the installed package,
    before any test of theirs ran. The other four members shipped the same way and
    were merely large: `dist/testing.js` was 45,701 lines in React and 84,178 in Vue,
    against 93 and 52 for the barrel beside it.

    ## What happened

    All five declared their testing library in `peerDependenciesMeta` and in no
    `peerDependencies`. npm reads that meta as a MODIFIER, so a name with no peer of
    the same name modifies nothing and is ignored — the quiet half. The loud half is
    the build: tsup externalises `dependencies` and `peerDependencies` and nothing
    else, so the library was bundled INTO the package that meant to borrow it from
    the consumer. What React inlined was CJS reaching `react` through a dynamic
    `require`, which esbuild's ESM shim answers by throwing.

    `@lankajs/tool-di` had it right all along — `vite` in both places — which is what
    makes this a rule rather than a preference. `scripts/scaffold.mjs` now refuses a
    `peerOptional` naming something absent from `peer`, and says what shipped when it
    was missing.

    ## Why nothing caught it

    Two blind spots, both now closed.

    `scripts/verify-build.mjs` is the one place tarballs are installed and imported,
    and it never asked for this entry: every suite in this repository reaches
    `renderWithLanka` by its relative path. It checks the subpath now.

    It also was not building these packages. Its build step filtered `./modules/*`,
    which is one level deep — it selected the seven modules at the top of `modules/`
    and none of the eighteen below, the whole `bindings/` shelf among them. Their
    tarballs were packed from whatever `dist` a previous run had left, which is the
    stale-directory failure the file's own first section exists to prevent. The set
    built is now derived from the same registry as the set packed.

## 0.1.0

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

### Patch Changes

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

- Updated dependencies [4178c0c]
- Updated dependencies [8349d0b]
- Updated dependencies [9ae4f10]
- Updated dependencies [d0e4474]
- Updated dependencies [912c1c1]
- Updated dependencies [efaaf46]
    - lanka@2.0.0
