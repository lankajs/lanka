---
name: lanka-vue
description: Read a lanka ViewModel from a Vue component with useLankaVM, declare one that is callable already by importing core's six ViewModel factories from @lankajs/vue, give Vue's read to a ViewModel you did not declare — one built by a class — with toLankaCallableVM, or declare a Pinia-shaped composable with defineLankaComposable and destructure it through lankaVMToRefs. Use when writing or reviewing a Vue or Nuxt screen in a lanka application, when declaring a ViewModel a Vue screen will read, when a ViewModel is built by a class extending ALankaVM, when a template shows a value that never updates, when a destructured field stops tracking, when a module-level read leaks a subscription, or when reviewing code that imports `@lankajs/vue`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/vue
    version: "0.2.0"
---

# @lankajs/vue

One call to read a ViewModel, plus the Pinia spelling for a codebase that
expects one. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick the call

| The situation                             | Use                                              |
| ----------------------------------------- | ------------------------------------------------ |
| a component reads a ViewModel             | `useLankaVM(todoVM)` — a `ShallowRef`            |
| it needs one derived value                | `useLankaVM(todoVM, (s) => s.todos.length)`      |
| DECLARING a ViewModel a Vue screen reads  | `createLankaVM` from `@lankajs/vue` — callable   |
| a ViewModel you did NOT declare — a CLASS | `toLankaCallableVM(new RunVM().build())`         |
| the codebase reads like Pinia             | `defineLankaComposable(todoVM)`, at module level |
| destructuring a composable's fields       | `lankaVMToRefs(todos)`                           |
| outside a component — a handler, a module | `todoVM.getState()`                              |
| a component test                          | `renderWithLanka` from `@lankajs/vue/testing`    |

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

It answers a **`ShallowRef`** — Vue's own idea of reactivity, which is the one
thing the shelf does not make uniform. So `state.todos` in a template and
`state.value.todos` in a script. Flattening the ref would be a second reactivity
system fighting the first, and every `watch` you wrote would stop seeing changes.

## Declaring a ViewModel through this package

The six factory names are core's own — `createLankaVM`, `createLazyLankaVM`,
`createStatelessLankaVM`, `createLazyStatelessLankaVM`,
`createSharedStoreLankaVM`, `createLazySharedStoreLankaVM` — with the same config
and the same generics, so only the import line differs:

```ts
import { createLankaVM } from "@lankajs/vue"; // not "lanka/viewmodel"

export const useTodosVM = createLankaVM<ITodosState, ITodosActions>({ … });
```

```vue
<script setup lang="ts">
const state = useTodosVM();
const count = useTodosVM((todos) => todos.rows.length);
</script>
```

- **The declaration is at module level, the read is per CALL.** What is
  pre-applied is `useLankaVM`, so each call opens its own subscription inside the
  calling component's scope. A read applied at the declaration would open ONE
  subscription at import time, outside any scope, shared by every component.
- **The result is also the ViewModel.** `useTodosVM.getState()`,
  `useTodosVM.subscribe()`, `useTodosVM.name` and `dispose` work outside a
  component, and a ViewModel declared with `createLazyLankaVM` still builds on
  first use.
- **Every binding publishes the same six.** The vocabulary does not change
  between frameworks; what the call ANSWERS does — a `ShallowRef` here, typed
  `ILankaVMRef`. `TLankaVueCallableVM` names such a declaration when one has to
  be annotated or passed on.
- **`defineLankaComposable` is unchanged**, and so is `lankaVMToRefs`. These six
  answer a ref, because `useLankaVM` answers one.

## The Pinia spelling

```ts
// todosVM.ts — at module level, the way `defineStore` is declared
import { defineLankaComposable } from "@lankajs/vue";

export const useTodosVM = defineLankaComposable(todosVM);
```

```vue
<script setup lang="ts">
const todos = useTodosVM();
const { rows, isLoading } = lankaVMToRefs(todos);
</script>
```

`todos.rows` in the script and in the template, no `.value` anywhere, and
`todos.load()` for an action.

- **It answers a FUNCTION, and each CALL builds its own reader** inside the
  calling component's scope, with its own subscription and its own recording.
  A module-level reader would subscribe at import time, outside any scope, and
  two components reading different keys would wake each other.
- **Two components get two objects** where Pinia answers one. The ViewModel
  behind them is the same and there is no second copy of the state; what differs
  is the recording, which belongs to whoever did the reading.
- **`$stop` is the one meta member**, `$`-prefixed so it cannot collide with a
  state key. A component scope calls it for you.
- **Destructuring loses reactivity, exactly as in Pinia.** `const { rows } =
todos` reads once. `lankaVMToRefs` is `storeToRefs` under a name this shelf
  uses; it leaves actions out on purpose, because an action is stable for the
  life of the ViewModel and a ref would make every call site write
  `load.value()`.

## What re-renders

Without a selector the ref carries a value that RECORDS which keys you read, and
the next change repaints only if one of those moved. With a selector, the
selector decides and tracking is bypassed.

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter is invisible to it, so a change to that key repaints
> nothing and the screen freezes with no error. Set
> `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT read the
> underlying keys in the template "for the side effect": that is dead code, and a
> refactor or a lint autofix removes it. In development the framework announces
> the mismatch by ViewModel and key name.

## Releasing the subscription

Inside a component or an `effectScope`, `onScopeDispose` does it and you do
nothing. Called OUTSIDE one — a module-level read, a test — there is no scope to
attach to, so the returned ref carries `stop()` and you own it:

```ts
const state = useLankaVM(todoVM);
state.stop();
```

## Testing

```ts
import { renderWithLanka } from "@lankajs/vue/testing";

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

One hold per reader, declared in `setup` — never at module level and never
shared between two components. A selector answering a **primitive** needs none
of this. The comparison is one level deep: own keys, same count, `Object.is` on
each value, arrays included.

## Never do these

- **Never pass an object-building selector without a hold.** The reader then
  wakes for every change in the ViewModel, selector or no selector.
- **Never destructure a composable directly.** `const { rows } = todos` reads
  once and never updates again — right on the first paint, wrong after it.
- **Never call `defineLankaComposable` inside a component.** It is a declaration,
  like `defineStore`; the call it returns is what a component uses.
- **Never read `state.value` in a template or drop `.value` in a script.** That
  is Vue's rule about refs, and this binding does not bend it.
- **Never leave a `useLankaVM` call outside a scope unstopped.** No scope means
  no `onScopeDispose`, and the subscription outlives the reader.
- **Never expect `"use client"` here.** That is a React Server Components
  mechanism; Nuxt renders this package on the server as ordinary code.

## Symptom → cause

| What you see                                      | What it is                                    |
| ------------------------------------------------- | --------------------------------------------- |
| a screen repainting for changes it never selected | an object selector with no hold               |
| the first paint is right, nothing updates         | a destructure without `lankaVMToRefs`         |
| `[object Object]` in a template                   | `state` where the script needed `state.value` |
| the screen never updates, no error                | the tracking blind spot — a derived getter    |
| two components waking on each other's keys        | one reader shared instead of one call each    |
| a growing subscription count in a test            | a `useLankaVM` outside a scope, never stopped |

## More

`reference.md` — the full guide: the ref rules, the composable in detail, and
what this package deliberately is not.
