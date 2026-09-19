---
name: lanka-solid
description: Read a lanka ViewModel from a Solid component with useLankaVM, which answers an Accessor, or read it the way Solid reads a store with toLankaSolidVM. Use when writing or reviewing a Solid or SolidStart screen in a lanka application, when JSX does not update after state changed, when a read outside an owner leaks a subscription, when deciding where a ViewModel's writes belong, or when reviewing code that imports `@lankajs/solid`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/solid
    version: "0.0.0"
---

# @lankajs/solid

One call to read a ViewModel, plus the store-shaped read Solid expects for an
object. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick the call

| The situation                             | Use                                             |
| ----------------------------------------- | ----------------------------------------------- |
| a component reads a ViewModel             | `useLankaVM(todoVM)` — an `Accessor`            |
| it needs one derived value                | `useLankaVM(todoVM, (s) => s.todos.length)`     |
| the codebase reads like `createStore`     | `toLankaSolidVM(todoVM)` — `todos.rows`         |
| outside a component — a handler, a module | `todoVM.getState()`                             |
| a component test                          | `renderWithLanka` from `@lankajs/solid/testing` |

```tsx
import { For, Show } from "solid-js";
import { useLankaVM } from "@lankajs/solid";
import { todoVM } from "./todoVM";

export const TodoScreen = () => {
	const state = useLankaVM(todoVM);

	return (
		<Show when={!state().isLoading} fallback={<p>loading</p>}>
			<ul onClick={() => void state().load()}>
				<For each={state().todos}>{(todo) => <li>{todo.title}</li>}</For>
			</ul>
		</Show>
	);
};
```

It answers an **`Accessor`** — Solid's own idea of reactivity, which is the one
thing the shelf does not make uniform. Call it where you read: `state().todos`
inside the JSX, not destructured above it.

## The store-shaped read

```tsx
import { toLankaSolidVM } from "@lankajs/solid";

const todos = toLankaSolidVM(todoVM);

<For each={todos.rows}>{(row) => <li>{row}</li>}</For>;
```

No call, and the read itself is the subscription: it registers the surrounding
computation with Solid AND records the key in the access tracker, in one access,
so a view that never read `unread` is not re-run when it moves.

**It is the read half only.** Solid's store is a write path as well, and a
ViewModel's writes belong to its actions; a `setStore` beside them would be a
second place state changes. `$stop` is the one meta member, `$`-prefixed so it
cannot collide with a state key.

## What re-renders

Without a selector the accessor carries a value that RECORDS which keys you read,
and the next change re-runs a computation only if one of those moved. With a
selector, the selector decides and tracking is bypassed.

Tracking earns its place even in a framework that already skips work: without it
every change writes a new object into the signal and every expression reading ANY
part of it re-runs. The tracker keeps the signal UNCHANGED when nothing you read
moved — and an unchanged signal is work Solid never starts.

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter is invisible to it, so a change to that key re-runs
> nothing and the screen freezes with no error. Set
> `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT read the
> underlying keys in the view "for the side effect": that is dead code, and a
> refactor or a lint autofix removes it. In development the framework announces
> the mismatch by ViewModel and key name.

## Releasing the subscription

Inside a component or a root, `onCleanup` releases it with the owner and you do
nothing. Called outside one there is no owner, so the accessor carries `stop()`
and you own it.

## Testing

```tsx
import { renderWithLanka } from "@lankajs/solid/testing";

renderWithLanka(() => <TodoScreen />, {
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

One hold per reader, declared inside the component — never at module level and never
shared between two components. A selector answering a **primitive** needs none
of this. The comparison is one level deep: own keys, same count, `Object.is` on
each value, arrays included.

## Never do these

- **Never pass an object-building selector without a hold.** The reader then
  wakes for every change in the ViewModel, selector or no selector.
- **Never destructure the accessor's value.** `const { todos } = state()` reads
  once, outside any computation, and never tracks again.
- **Never call the accessor above the JSX.** `const todos = state().todos` at the
  top of a component reads in the component body, which runs once; read where the
  value is used.
- **Never write through `toLankaSolidVM`.** It is the read half; writes are the
  ViewModel's actions, and a second write path is a second place state changes.
- **Never leave a read outside an owner unstopped.** No owner means no
  `onCleanup`, so `$stop` or `stop()` is yours to call.
- **Never assume Solid's fine-grained updates make tracking redundant.** Without
  it every reader of the signal re-runs.

## Symptom → cause

| What you see                                      | What it is                                        |
| ------------------------------------------------- | ------------------------------------------------- |
| a screen repainting for changes it never selected | an object selector with no hold                   |
| the first paint is right, nothing updates         | the accessor's value was destructured             |
| a whole component re-runs on any change           | the accessor read once, above the JSX             |
| the screen never updates, no error                | the tracking blind spot — a derived getter        |
| a subscription outliving the component            | a read outside an owner, `stop()` never called    |
| state changing from two places                    | a write path added beside the ViewModel's actions |

## More

`reference.md` — the full guide: the tracking rules, the store-shaped read in
detail, and what this package deliberately is not.
