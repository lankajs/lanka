---
name: lanka-react
description: Read a lanka ViewModel from a React component with useLankaVM, declare one that is a hook already by importing core's factories from @lankajs/react, keep the useTodoVM() spelling on a ViewModel you did not declare with toLankaReactVM, and stop a selector from repainting for changes it did not pick with useLankaShallow. Use when writing or reviewing a React screen in a lanka application, when declaring a ViewModel a React screen will read, when a component does not repaint after state changed, when a selector repaints a screen for changes it did not select, when deciding what a server component may read, or when reviewing code that imports `@lankajs/react`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/react
    version: "0.1.1"
---

# @lankajs/react

One call to read a ViewModel, two spellings, and one wrapper that makes a
selector mean something. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick the call

| The situation                              | Use                                                   |
| ------------------------------------------ | ----------------------------------------------------- |
| a component reads a ViewModel              | `useLankaVM(todoVM)`                                  |
| it needs one derived value                 | `useLankaVM(todoVM, (s) => s.todos.length)`           |
| the selector builds an **object or array** | `useLankaVM(todoVM, useLankaShallow((s) => ({ … })))` |
| DECLARING a ViewModel React will read      | `createLankaVM` from `@lankajs/react` — already a hook |
| the codebase already writes `useTodoVM()`  | `toLankaReactVM(todoVM)`, once per file               |
| outside a component — a handler, a module  | `todoVM.getState()`                                   |
| a component test                           | `renderWithLanka` from `@lankajs/react/testing`       |

```tsx
import { useLankaVM } from "@lankajs/react";
import { todoVM } from "./todoVM";

export const TodoScreen = () => {
	const { todos, isLoading, load } = useLankaVM(todoVM);

	if (isLoading) return <p>loading</p>;

	return (
		<ul onClick={() => void load()}>
			{todos.map((t) => (
				<li key={t.id}>{t.title}</li>
			))}
		</ul>
	);
};
```

It answers **the state itself** — React's own idea of reactivity, which is the
one thing the shelf does not make uniform.

## The selector that repaints for everything

`useLankaVM(vm, (s) => ({ a: s.a }))` is the commonest thing a React reader
writes. It is safe — the binding runs a selector once per state object and holds
the answer — but on its own it wakes the component for **every** change in the
ViewModel, including the keys the selector exists to ignore: a fresh object is
new whenever the state is new.

```tsx
import { useLankaShallow, useLankaVM } from "@lankajs/react";

const { title, status } = useLankaVM(
	missionVM,
	useLankaShallow((s) => ({ title: s.title, status: s.status })),
);
```

A selector answering a **primitive** never needed it, which is what makes the
cost quiet: the shape that is free and the shape that repaints on everything
look the same on the page. Wrap every selector whose answer is an object or an
array.

Before the binding held the selection, an unwrapped object selector **crashed on
the first paint** with "Maximum update depth exceeded". If you meet that message,
you are on a version older than this one.

## The hook spelling, for a codebase that has it

Declare it through this package and it is a hook already. The six factory names
are core's own — `createLankaVM`, `createLazyLankaVM`, `createStatelessLankaVM`,
`createLazyStatelessLankaVM`, `createSharedStoreLankaVM`,
`createLazySharedStoreLankaVM` — with the same config and the same generics, so
only the import line differs:

```ts
import { createLazyLankaVM } from "@lankajs/react"; // not "lanka/viewmodel"

export const useFAQViewModel = createLazyLankaVM<IFAQState, IFAQActions>({ … });
```

For a ViewModel you did NOT declare here — a class, a library's, or one declared
with core's factory because a server component reads it — wrap it by hand:

```ts
import { toLankaReactVM } from "@lankajs/react";

export const useFAQViewModel = toLankaReactVM(faqVM);
```

```tsx
const supportLink = useFAQViewModel((state) => state.supportLink);
useFAQViewModel.getState().trackSupportContacted("faq"); // in a handler
```

One import line or one wrapper per ViewModel file, no call site touched. Either
works on any ViewModel however it was built, wraps ONE store, adds no state, and
laziness survives — reading `useFAQViewModel.name` constructs nothing.

Which spelling is taste, with one thing to weigh: `useLankaVM(todoVM)` reads a
ViewModel a screen was HANDED and needs the declaration to know nothing about
React, so a shared component written that way moves between frameworks unedited.
Declaring through `@lankajs/react` also puts the declaration in a client module,
because what it answers is a hook — see Server components below.

## What re-renders

Without a selector the value RECORDS which keys you read, and the next change
repaints only if one of those moved. With a selector, the selector decides and
tracking is bypassed.

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter is invisible to it, so a change to that key repaints
> nothing and the screen freezes with no error. Set
> `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT read the
> underlying keys in the view "for the side effect": that is dead code, and a
> refactor or a lint autofix removes it. In development the framework announces
> the mismatch by ViewModel and key name.

## Server components

`lanka/viewmodel` carries no `"use client"`, so a server component may read
`todoVM.getState()`. This barrel does carry it, because `useLankaVM` is a hook —
so a server component reads, and only what RENDERS is a client component.

## Testing

```tsx
import { renderWithLanka } from "@lankajs/react/testing";

renderWithLanka(<TodoScreen />, {
	fakes: { gateways: { TodoGateway: { list: () => Promise.resolve([]) } } },
});
```

It takes an **element**, not a component — React Testing Library's own shape.
Every call gets a fresh instance and disposes the previous one.

## Never do these

- **Never pass an object-returning selector without `useLankaShallow`.** The
  screen then repaints for every change in the ViewModel, selector or no selector.
- **Never call `useLankaVM` outside a component.** It is a hook; use
  `todoVM.getState()` in a handler or a module.
- **Never import this barrel from a server component.** It carries
  `"use client"`; read the ViewModel's state directly instead.
- **Never subscribe by hand to "fix" the blind spot.** Turn the optimization off
  on the ViewModel — that is the switch built for it.
- **Never look for a `stop()`.** React releases the subscription on unmount; the
  other bindings publish one because their call can happen outside a scope.

## Symptom → cause

| What you see                                      | What it is                                   |
| ------------------------------------------------- | -------------------------------------------- |
| a screen repainting for changes it never selected | an object selector without `useLankaShallow` |
| the screen never updates, no error                | the tracking blind spot — a derived getter   |
| "Invalid hook call"                               | `useLankaVM` outside a component             |
| a build error about `"use client"`                | this barrel imported from a server component |
| a test sees the previous test's state             | a render that bypassed `renderWithLanka`     |

## More

`reference.md` — the full guide: the tracking rules, the callable spelling in
detail, and what this package deliberately is not.
