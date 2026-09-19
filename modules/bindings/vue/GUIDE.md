# @lankajs/vue — user guide

How a Vue component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component re-renders and when it deliberately does not
- why a selector that builds an object needs a hold, and when it needs nothing
- what to do about a ViewModel that derives what the screen shows
- how to test a Vue component with a live framework behind it

## When to reach for this

Reach for it the moment a Vue component has to read a lanka ViewModel — that is
the whole job, and there is no other supported way to do it. Install this one
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
npm install @lankajs/vue vue zustand
```

> [!IMPORTANT]
> `vue` is already in your project; `zustand` is `lanka`'s own peer. npm adds a
> missing peer for you and pnpm does not, so the line names all of them.

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
reactivity and the one every other binding on the shelf parallels. It is not how
a Pinia codebase reads, so this package publishes that too — declaration and all:

```ts
// todosVM.ts — at module level, the way `defineStore` is declared
import { defineLankaComposable } from "@lankajs/vue";

export const useTodosVM = defineLankaComposable(todosVM);
```

```vue
<script setup lang="ts">
const todos = useTodosVM();
</script>

<template>
	<li v-for="row in todos.rows" :key="row">{{ row }}</li>
</template>
```

`todos.rows` in the script and in the template, no `.value` anywhere, and
`todos.load()` for an action.

`$stop` is the one member the composable adds, and the `$` prefix is Pinia's
convention for Pinia's reason: the keys belong to the application, and a meta
member sharing that namespace collides the day somebody adds a `stop` of their
own. A component scope calls it for you; you need it only for a reader built
outside one.

**It is still a ViewModel, and it is called one.** Pinia's noun for the thing a
component reads is "store", and this reads the way one does — but what holds the
state, the actions and the scenario bindings is the ViewModel, and naming it
after the shape it wears would hide where the work lives.

**It answers a FUNCTION, and that is not only for the look of it.** A reader
built at module level would open its subscription at IMPORT time, outside any
component scope — nothing would release it, and every component would share ONE
recording, so two components reading different keys would wake each other. Each
CALL builds a reader inside the calling component's scope, with its own
subscription and its own recording, and Vue releases it when that component goes.

Where it differs from Pinia: `useTodosVM()` in two components answers two
objects, where Pinia answers one. The ViewModel behind them is the same one and
there is no second copy of the state — what differs is the recording, which
belongs to whoever did the reading.

**Destructuring loses reactivity, exactly as it does in Pinia.**
`const { rows } = todos` reads once and stops tracking:

```ts
const { rows, isLoading } = lankaVMToRefs(todos); // rows.value in script, {{ rows }} in template
```

Actions are left out of `lankaVMToRefs` deliberately: an action is a stable
function for the life of the ViewModel, so `const { load } = todos` was already
correct and a ref would make every call site write `load.value()`.

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

## A selector that builds its answer

`useLankaVM(vm, (state) => ({ … }))` is safe — nothing loops — but on its own it
wakes the component for **every** change in the ViewModel, including the keys
the selector exists to ignore. The reason is identity: that object is new on
every call, and a binding compares selections with `Object.is`.

`createLankaShallowHold` is the comparison that fixes it. It answers the
PREVIOUS object while nothing in the selection moved, one level deep — own keys,
same count, `Object.is` on each value, arrays included:

```vue
<script setup lang="ts">
import { createLankaShallowHold } from "lanka/viewmodel";
import { useLankaVM } from "@lankajs/vue";

const hold = createLankaShallowHold<{ title: string; status: string }>();
const mission = useLankaVM(missionVM, (state) =>
	hold({ title: state.title, status: state.status }),
);
</script>

<template>
	<h1>{{ mission.title }} — {{ mission.status }}</h1>
</template>
```

One hold per reader, created in `setup` beside the read — never at module level
and never shared between two components, because the answer it holds belongs to
whoever selected it.

A selector answering a **primitive** needs none of this: `(state) => state.title`
compares equal to itself and was always free. A selection with a **nested**
object wants a selector that picks the leaves — comparing deeper would mean
walking a state of unknown size on every read, which is the cost a selector was
taken to avoid.

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

`@lankajs/vue/testing` renders a component with a bootstrapped framework, so a component
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

## Recap

- `useLankaVM(todoVM)` is the one call, and every binding publishes that name.
- It answers a `ShallowRef`: `state.todos` in a template, `state.value.todos` in a script. That difference is Vue's, and the shelf does not hide it.
- Without a selector you get a value that records which keys you read, and only those keys wake the ref.
- A key reached only through a derived getter is invisible to tracking: set `enableAccessTrackingOptimization: false` on that ViewModel.
- `defineLankaComposable` gives the Pinia spelling — `todos.rows`, no `.value` — and `lankaVMToRefs` keeps reactivity through a destructure.
- Inside a component or an `effectScope` the subscription is released for you; outside one, `stop()` is yours to call.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../../README.md](../../../README.md)
