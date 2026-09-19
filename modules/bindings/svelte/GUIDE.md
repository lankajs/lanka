# @lankajs/svelte — user guide

How a Svelte component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component re-renders and when it deliberately does not
- why a selector that builds an object needs a hold, and when it needs nothing
- what to do about a ViewModel that derives what the screen shows
- how to test a Svelte component with a live framework behind it

## When to reach for this

Reach for it the moment a Svelte component has to read a lanka ViewModel — that
is the whole job, and there is no other supported way to do it. Install this one
package and no other binding: the five are alternatives, not layers.

You do NOT need it to reach the rest of the framework. Gateways, scenarios and
the locator are plain calls with no view in them, and `viewModel.getState()`
works anywhere, including on a server.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/svelte svelte zustand
```

> [!IMPORTANT]
> `svelte` is already in your project; `zustand` is `lanka`'s own peer. No
> compiler plugin is needed — this package is plain TypeScript. npm adds a
> missing peer for you and pnpm does not, so the line names all of them.

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

## Svelte's store contract, when you want `$`

`useLankaVM` answers an object of getters, which is Svelte 5's own shape: a read
registers with the reactivity graph and with the access tracker in one access,
and nothing needs a `$`.

The store contract is the other half of Svelte and has not gone anywhere —
`$page`, `derived`, `get`, and every codebase that has not moved to runes — so
this package publishes it:

```svelte
<script lang="ts">
	import { toLankaSvelteVM } from "@lankajs/svelte";
	const todos = toLankaSvelteVM(todosVM);
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
with `Object.is`.

### A selector that builds its answer

That comparison is why a selector answering a fresh object wakes the reader for
**every** change in the ViewModel, including the keys it exists to ignore: the
object is new on every call, so it is never identical to the previous one.
`createLankaShallowHold` is the comparison that fixes it — it answers the
PREVIOUS object while nothing in the selection moved, one level deep over own
keys:

```svelte
<script lang="ts">
	import { createLankaShallowHold } from "lanka/viewmodel";
	import { useLankaVM } from "@lankajs/svelte";

	const hold = createLankaShallowHold<{ title: string; status: string }>();
	const mission = useLankaVM(missionVM, (state) =>
		hold({ title: state.title, status: state.status }),
	);
</script>

<h1>{mission.current.title} — {mission.current.status}</h1>
```

One hold per reader, created beside the read in the component — never at module
level and never shared between two of them, because the answer it holds belongs
to whoever selected it.

A selector answering a **primitive** needs none of this and was always free. A
selection with a **nested** object wants a selector that picks the leaves —
comparing deeper would mean walking a state of unknown size on every read, which
is the cost a selector was taken to avoid.

## What re-renders, and what does not

Without a selector you get a value that RECORDS which keys you read. The next
change re-renders only if one of those moved:

```ts
// reads `todos`; a change to `isLoading` alone repaints nothing
```

With a selector, the selector decides and tracking is bypassed:

```ts
const count = useLankaVM(todoVM, (state) => state.todos.length);
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

## No compiler

This package is plain TypeScript: `createSubscriber` from `svelte/reactivity` is
a runtime function, so nothing here needs the Svelte compiler and your build
needs no extra plugin.

## Which spelling, and when

`useLankaVM` is the default. A read registers with the reactivity graph and with
the access tracker in one access, it composes with `$state` and `$derived`, and
it is the plain read every other binding on the shelf writes — so a screen moves
between frameworks with the view rewritten and the vocabulary kept.

`toLankaSvelteVM` is for when something else demands the store contract: a
`derived`, a `get`, a helper from `svelte/store`, or a codebase that has not
moved to runes. Reaching for `$todoVM` by preference is the one case to weigh,
because it is the spelling no other framework has.

## Testing

`@lankajs/svelte/testing` renders a component with a bootstrapped framework, so a component
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

## Recap

- `useLankaVM(todoVM)` is the one call, and every binding publishes that name.
- It answers an object of getters, so reading `state.todos` registers with Svelte's graph and records the key in one access.
- A selected read answers one value under `.current` — Svelte's own convention, and the only shape that can carry a selection which is not an object.
- A key reached only through a derived getter is invisible to tracking: set `enableAccessTrackingOptimization: false` on that ViewModel.
- `toLankaSvelteVM` is there for the `$` spelling; the plain read is what the other four frameworks write.
- Inside a component the subscription is released for you; outside one, `stop()` is yours to call.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../../README.md](../../../README.md)
