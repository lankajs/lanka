---
"@lankajs/react": minor
"@lankajs/vue": minor
"@lankajs/svelte": minor
"@lankajs/solid": minor
"@lankajs/angular": minor
"@lankajs/tool-testing": minor
---

A selector meant two different things depending on which binding answered, and
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
