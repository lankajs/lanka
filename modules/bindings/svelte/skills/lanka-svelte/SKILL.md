---
name: lanka-svelte
description: Read a lanka ViewModel from a Svelte 5 component with useLankaVM, select one value through `.current`, declare one that reads itself by importing core's six ViewModel factories from @lankajs/svelte, or satisfy the `svelte/store` contract with toLankaSvelteVM so `$todos` works. Use when writing or reviewing a Svelte or SvelteKit screen in a lanka application, when declaring a ViewModel a Svelte screen will read, when markup does not update after state changed, when a selector wakes on every change, when a store helper refuses a ViewModel, or when reviewing code that imports `@lankajs/svelte`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/svelte
    version: "0.1.1"
---

# @lankajs/svelte

One call to read a ViewModel, and the store contract for the half of Svelte that
still speaks it. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick the call

| The situation                                     | Use                                                     |
| ------------------------------------------------- | ------------------------------------------------------- |
| a component reads a ViewModel                     | `useLankaVM(todoVM)` — an object of getters             |
| it needs one derived value                        | `useLankaVM(todoVM, (s) => s.rows.length)` → `.current` |
| DECLARING a ViewModel a Svelte screen reads       | `createLankaVM` from `@lankajs/svelte` — callable       |
| `derived`, `get`, a `$` prefix, a SvelteKit store | `toLankaSvelteVM(todoVM)`                               |
| outside a component — a handler, a module         | `todoVM.getState()`                                     |
| a component test                                  | `renderWithLanka` from `@lankajs/svelte/testing`        |

```svelte
<script lang="ts">
	import { useLankaVM } from "@lankajs/svelte";
	import { todoVM } from "./todoVM";

	const state = useLankaVM(todoVM);
</script>

{#if state.isLoading}
	<p>loading</p>
{:else}
	<ul onclick={() => state.load()}>
		{#each state.todos as todo (todo.id)}
			<li>{todo.title}</li>
		{/each}
	</ul>
{/if}
```

It answers **an object whose properties are getters** — Svelte 5's own shape, and
the one thing the shelf does not make uniform. A read registers with the
reactivity graph and with the access tracker in ONE access, so nothing needs a
`$`. `const` is right: the object never changes, its getters do.

**No compiler and no extra plugin.** `createSubscriber` from `svelte/reactivity`
is a runtime function, so this package is plain TypeScript.

## Selecting one value

```svelte
<script lang="ts">
	const count = useLankaVM(todoVM, (state) => state.rows.length);
</script>

<p>{count.current}</p>
```

`current` is Svelte's own convention for a reactive value, the way `MediaQuery`
and the rest of `svelte/reactivity` read. Any selector, including one answering a
number.

The reader wakes when the **selection** moves, compared with `Object.is` — so a
selector building a fresh object every call is a reader saying it depends on
everything. Pick the leaves instead.

## Declaring a ViewModel through this package

The six factory names are core's own — `createLankaVM`, `createLazyLankaVM`,
`createStatelessLankaVM`, `createLazyStatelessLankaVM`,
`createSharedStoreLankaVM`, `createLazySharedStoreLankaVM` — with the same config
and the same generics, so only the import line differs:

```ts
import { createLankaVM } from "@lankajs/svelte"; // not "lanka/viewmodel"

export const useTodosVM = createLankaVM<ITodosState, ITodosActions>({ … });
```

```svelte
<script lang="ts">
	const state = useTodosVM();
	const count = useTodosVM((todos) => todos.rows.length);
</script>

<p>{count.current} of {state.rows.length}</p>
```

- **The declaration is at module level, the read is per CALL.** What is
  pre-applied is `useLankaVM`, so each call builds its own view inside the
  component that made it. A view built at import time has no effect to release
  its subscription, and every component would share one recording.
- **Both arms come with it.** No selector answers the object of getters
  (`TLankaVMView`); a selector answers one value under `current`.
- **The result is also the ViewModel.** `useTodosVM.getState()`,
  `useTodosVM.subscribe()`, `useTodosVM.name` and `dispose` work outside a
  component, and a ViewModel declared with `createLazyLankaVM` still builds on
  first use.
- **Every binding publishes the same six.** The vocabulary does not change
  between frameworks; what the call ANSWERS does.
  `TLankaSvelteCallableVM` names such a declaration when one has to be annotated.
- **`toLankaSvelteVM` is unchanged and accepts what these answer**, because the
  ViewModel's own `subscribe` is forwarded onto the result — `$todosVM` and
  `useTodosVM()` read one declaration.

## The store contract, when you want `$`

```svelte
<script lang="ts">
	import { toLankaSvelteVM } from "@lankajs/svelte";
	const todos = toLankaSvelteVM(todoVM);
</script>

{#each $todos.rows as row}<li>{row}</li>{/each}
```

`run` is called immediately and synchronously, so `$todos` is never `undefined`
on the first render, and `derived`, `get` and every other `svelte/store` helper
accept it. Each subscriber gets its own recording.

Reach for it when something else demands the contract — a `derived`, a `get`, a
codebase that has not moved to runes. `useLankaVM` is the default, because a
plain read is what every other binding on the shelf writes.

## What re-renders

Without a selector the view RECORDS which keys you read, and the next change
repaints only if one of those moved. With a selector, the selector decides and
tracking is bypassed.

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter is invisible to it, so a change to that key repaints
> nothing and the screen freezes with no error. Set
> `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT read the
> underlying keys in the markup "for the side effect": that is dead code, and a
> refactor or a lint autofix removes it. In development the framework announces
> the mismatch by ViewModel and key name.

## Releasing the subscription

`createSubscriber` releases it when the last effect reading the view is
destroyed, which is every case inside a component. A read where there is no
effect at all — a module-level snapshot, a script, a test — has none, so the view
carries `stop()` and you own it.

## Testing

```ts
import { renderWithLanka } from "@lankajs/svelte/testing";

renderWithLanka(TodoScreen, {
	fakes: { gateways: { TodoGateway: { list: () => Promise.resolve([]) } } },
});
```

Every call gets a fresh instance and disposes the previous one.

## A selector that builds an object

A selector answering a fresh object is never identical to its own last answer,
so the reader wakes for EVERY change in the ViewModel — including the keys the
selector exists to ignore. Hold it:

```ts
import { createLankaShallowHold } from "lanka/viewmodel";

const hold = createLankaShallowHold<{ title: string }>();
const mission = useLankaVM(missionVM, (s) => hold({ title: s.title }));
```

One hold per reader, declared in the component script — never at module level and never
shared between two components. A selector answering a **primitive** needs none
of this. The comparison is one level deep: own keys, same count, `Object.is` on
each value, arrays included.

## Never do these

- **Never pass an object-building selector without a hold.** The reader then
  wakes for every change in the ViewModel, selector or no selector.
- **Never destructure the view.** `const { rows } = state` reads the getter once
  and the value stops tracking; keep reading through `state.rows`.
- **Never look for `.current` without a selector.** The plain call answers the
  getters directly; `current` is the selected shape only.
- **Never build a fresh object in a selector.** `Object.is` then says it changed
  every time, and the reader wakes on everything.
- **Never leave a read outside an effect unstopped.** A module-level or script
  read has no effect to hang on, so nothing releases the subscription but you.
- **Never reach for `$` by default.** `toLankaSvelteVM` is for the store
  contract; a plain read is the spelling the rest of the shelf shares.

## Symptom → cause

| What you see                                      | What it is                                      |
| ------------------------------------------------- | ----------------------------------------------- |
| a screen repainting for changes it never selected | an object selector with no hold                 |
| the first paint is right, nothing updates         | the view was destructured                       |
| `undefined` from a selected read                  | `.current` missing                              |
| a reader waking on every change                   | a selector returning a fresh object             |
| `derived` or `get` refuses the ViewModel          | it wants the store contract — `toLankaSvelteVM` |
| a subscription that outlives the test             | a read with no effect, `stop()` never called    |

## More

`reference.md` — the full guide: the tracking rules, the store contract in
detail, and what this package deliberately is not.
