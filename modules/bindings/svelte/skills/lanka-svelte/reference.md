<!-- Generated from modules/bindings/svelte/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/svelte@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/svelte svelte zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/bindings/svelte/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/bindings/svelte/_playground/playground.test.ts)

# @lankajs/svelte — user guide

How a Svelte component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component re-renders and when it deliberately does not
- what to do about a ViewModel that derives what the screen shows
- how to test a Svelte component with a live framework behind it

## The one call

`useLankaVM` is a function. Every member of `modules/bindings/` publishes that same
name, so moving a screen from one framework to another rewrites the view and not
the vocabulary.

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

It answers **an object whose properties are getters** — the one thing this shelf does not make uniform,
because that is Svelte's own idea of reactivity and a binding that hid it
would be a second reactivity system fighting the first.

## The store contract, when you want `$`

`useLankaVM` answers an object of getters, which is Svelte 5's own shape: a read
registers with the reactivity graph and with the access tracker in one access,
and nothing needs a `$`.

The store contract is the other half of Svelte and has not gone anywhere —
`$page`, `derived`, `get`, and every codebase that has not moved to runes — so
this package publishes it:

```svelte
<script lang="ts">
	import { toLankaSvelteStore } from "@lankajs/svelte";
	const todos = toLankaSvelteStore(todosVM);
</script>

{#each $todos.rows as row}<li>{row}</li>{/each}
```

It satisfies the contract properly: `run` is called immediately and
synchronously, so `$todos` is never `undefined` on the first render, and
`derived`, `get` and every other `svelte/store` helper accept it.

Each Svelte subscriber gets its own recording, because two readers of one
ViewModel read different keys and must be woken for different changes — the same
rule every binding on the shelf follows.

## Selecting one value

With a selector the call answers ONE value, under `current` — Svelte's own
convention for a reactive value, the way `MediaQuery` and the rest of
`svelte/reactivity` read:

```svelte
<script lang="ts">
	const count = useLankaVM(todosVM, (state) => state.rows.length);
</script>

<p>{count.current}</p>
```

Any selector, including one answering a number: the shape that carried the
selection's own keys could not, and a member of this shelf narrowing the shared
name is what the conformance suite's selector scenes now refuse.

The reader wakes when the SELECTION moves, not when the state does — compared
with `Object.is`. A selector building a fresh object every call is a reader
saying it depends on everything; pick the leaves instead.

## What re-renders, and what does not

Without a selector you get a value that RECORDS which keys you read. The next
change re-renders only if one of those moved:

```ts
// reads `todos`; a change to `isLoading` alone repaints nothing
```

With a selector, the selector decides and tracking is bypassed:

```ts
const count = useLankaVM(todoVM, (state) => ({ count: state.todos.length }));
```

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter — an action calling `get()` — is invisible to it, so a
> change to that key re-renders nothing and the screen freezes with no error.
>
> Set `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT patch
> it in the view by reading the underlying keys "for the side effect": that is
> dead code, and a refactor or a lint autofix removes it.
>
> In development the framework announces the mismatch by ViewModel and key name.

## Releasing the subscription

`createSubscriber` releases the subscription when the last effect reading this
view is destroyed, which is every case inside a component. A read where there is
no effect at all — a module-level snapshot, a script — has none, so the view
carries `stop()` and you own it.

## No compiler, and no store contract

This package is plain TypeScript: `createSubscriber` from `svelte/reactivity` is
a runtime function, so nothing here needs the Svelte compiler and your build
needs no extra plugin.

A ViewModel is ALMOST a Svelte store — the shapes differ only in that Svelte
calls its listener immediately and lanka does not — and bridging that is two
lines. It was rejected: the store contract is Svelte 4's way, it does not compose
with `$state`, and you would write `$todoVM` where every other framework writes
a plain read.

## Testing

`@svelte/testing` renders with a bootstrapped framework, so a component
test needs no bootstrap preamble of its own:

```ts
import { renderWithLanka } from "@lankajs/svelte/testing";

renderWithLanka(TodoScreen, {
	fakes: { gateways: { TodoGateway: { list: () => Promise.resolve([]) } } },
});
```

Every call gets a FRESH instance and disposes the previous one, so a test never
inherits its neighbour's subscriptions.

## What this package is not

It is a subscription and a render trigger, and nothing else. The recording of
which keys you read, the comparison that decides whether a change is worth a
render, and the blind-spot warning are all in `lanka` itself — which is why the
behaviour you see is the framework's rather than this package's reading of it,
and why `lankaViewBindingConformance` can hold every binding to one list.

If this package ever needs more than the ViewModel port gives it, the port has
the defect and the fix belongs in `lanka`, for every framework at once.
