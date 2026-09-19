# @lankajs/angular

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

- 9b0e5fc: `@lankajs/angular` — the same ViewModel, read from an Angular component.

    ```ts
    @Component({ template: `<li *ngFor="let row of state().rows">{{ row }}</li>` })
    export class TodoScreen {
    	protected readonly state = useLankaVM(todoVM);
    }
    ```

    It answers a `Signal`, and zoneless needs no extra step — a signal is what
    zoneless change detection reads.

    It is the one binding that REFUSES a call made outside its framework's scope
    rather than degrading. Vue's and Solid's publish a `stop()` for that case because
    both can still work without one; Angular cannot, because `DestroyRef` is the only
    way to learn the caller has gone. A refusal read once beats a leak found in
    production.

### Patch Changes

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
