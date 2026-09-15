<!-- Generated from modules/bindings/vue/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/vue@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/vue vue zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/bindings/vue/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/bindings/vue/_playground/playground.test.ts)

# @lankajs/vue — user guide

How a Vue component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component re-renders and when it deliberately does not
- what to do about a ViewModel that derives what the screen shows
- how to test a Vue component with a live framework behind it

## The one call

`useLankaVM` is a composable. Every member of `modules/bindings/` publishes that same
name, so moving a screen from one framework to another rewrites the view and not
the vocabulary.

```vue
<script setup lang="ts">
import { useLankaVM } from "@lankajs/vue";
import { todoVM } from "./todoVM";

const state = useLankaVM(todoVM);
</script>

<template>
	<p v-if="state.isLoading">loading</p>
	<ul v-else @click="state.load()">
		<li v-for="todo in state.todos" :key="todo.id">{{ todo.title }}</li>
	</ul>
</template>
```

It answers **a `ShallowRef`** — the one thing this shelf does not make uniform,
because that is Vue's own idea of reactivity and a binding that hid it
would be a second reactivity system fighting the first.

## The Vue spelling, if you prefer it

`useLankaVM` answers a `ShallowRef`, which is the honest shape for Vue's
reactivity and the one every other binding on the shelf parallels. It is not what
a Pinia codebase reads, so this package publishes that too:

```ts
import { defineLankaStore, lankaStoreToRefs } from "@lankajs/vue";

const todos = defineLankaStore(todosVM);

todos.rows; // in the script, no `.value`
todos.load(); // an action, off the store
```

```vue
<template>
	<li v-for="row in todos.rows" :key="row">{{ row }}</li>
</template>
```

**Destructuring loses reactivity, exactly as it does in Pinia.**
`const { rows } = todos` reads once and stops tracking — the first paint is right
and nothing updates after it, which is why it needs a named answer:

```ts
const { rows, isLoading } = lankaStoreToRefs(todos); // rows.value in script, {{ rows }} in template
```

Actions are left out of `lankaStoreToRefs` deliberately: an action is a stable
function for the life of the store, so `const { load } = todos` was already
correct and a ref would make every call site write `load.value()`.

It is one subscription over one store, with the same access tracking and the same
skips `useLankaVM` produces — the reads simply go to the ViewModel's current
state each time rather than to a snapshot, which is what lets a store be read
from ordinary code as well as from a template.

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

Inside a component or an `effectScope`, `onScopeDispose` releases the
subscription and you do nothing. Called OUTSIDE one — a module-level read, a
test — there is no scope to attach to, so the returned ref carries `stop()` and
you own it:

```ts
const state = useLankaVM(todoVM);
// …
state.stop();
```

## A template unwraps the ref, a script does not

`state.todos` in a template, `state.value.todos` in a script. That is Vue's own
rule about refs, and this package does not bend it: flattening the ref would be a
second reactivity system fighting the first, and every `watch` you wrote would
stop seeing changes.

## Testing

`@vue/testing` renders with a bootstrapped framework, so a component
test needs no bootstrap preamble of its own:

```ts
import { renderWithLanka } from "@lankajs/vue/testing";

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
