---
"lanka": patch
"@lankajs/react": minor
"@lankajs/vue": minor
"@lankajs/svelte": minor
"@lankajs/solid": minor
"@lankajs/angular": minor
---

Every binding now speaks its framework's own language, not only lanka's.

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
- **Vue** — `defineLankaStore(vm)` reads like Pinia: `store.rows` in the script
  and in the template, no `.value` anywhere, and `lankaStoreToRefs(store)` for
  the destructuring that would otherwise lose reactivity.
- **Svelte** — `toLankaSvelteStore(vm)` satisfies the store contract, so `$todos`
  works and `derived`, `get` and every `svelte/store` helper accept it.
- **Solid** — `toLankaSolidStore(vm)` is read as `store.rows` with no call, the
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
