---
name: lanka-react
description: Read a lanka ViewModel from a React component with useLankaVM, keep the useTodoVM() hook spelling with toLankaReactVM, and stop a selector from looping the render with useLankaShallow. Use when writing or reviewing a React screen in a lanka application, when a component does not repaint after state changed, when "Maximum update depth exceeded" appears on first paint, when deciding what a server component may read, or when reviewing code that imports `@lankajs/react`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/react
    version: "0.0.0"
---

# @lankajs/react

One call to read a ViewModel, two spellings, and one wrapper that exists to stop
a crash. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick the call

| The situation                              | Use                                                   |
| ------------------------------------------ | ----------------------------------------------------- |
| a component reads a ViewModel              | `useLankaVM(todoVM)`                                  |
| it needs one derived value                 | `useLankaVM(todoVM, (s) => s.todos.length)`           |
| the selector builds an **object or array** | `useLankaVM(todoVM, useLankaShallow((s) => ({ … })))` |
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

## The selector that loops the render

`useLankaVM(vm, (s) => ({ a: s.a }))` is the commonest thing a React reader
writes, and on its own it **crashes on the first paint**: the snapshot is read
during render, a fresh object comes back every time, React decides the store
changed, and you get "Maximum update depth exceeded" with a stack pointing at
React rather than at your selector.

```tsx
import { useLankaShallow, useLankaVM } from "@lankajs/react";

const { title, status } = useLankaVM(
	missionVM,
	useLankaShallow((s) => ({ title: s.title, status: s.status })),
);
```

A selector answering a **primitive** was always safe, which is what makes the
trap quiet: the shape that works and the shape that loops look the same on the
page. Wrap every selector whose answer is an object or an array.

## The hook spelling, for a codebase that has it

```ts
import { toLankaReactVM } from "@lankajs/react";

export const useFAQViewModel = toLankaReactVM(faqVM);
```

```tsx
const supportLink = useFAQViewModel((state) => state.supportLink);
useFAQViewModel.getState().trackSupportContacted("faq"); // in a handler
```

One wrapper per ViewModel file, no call site touched. It works on any ViewModel
however it was built, wraps ONE store, adds no state, and laziness survives —
reading `useFAQViewModel.name` constructs nothing.

Which spelling is taste, with one thing to weigh: `useLankaVM(todoVM)` is what
the other four bindings publish, so a screen written that way moves between
frameworks unedited.

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

- **Never pass an object-returning selector without `useLankaShallow`.** It is an
  infinite render, not a slow one.
- **Never call `useLankaVM` outside a component.** It is a hook; use
  `todoVM.getState()` in a handler or a module.
- **Never import this barrel from a server component.** It carries
  `"use client"`; read the ViewModel's state directly instead.
- **Never subscribe by hand to "fix" the blind spot.** Turn the optimization off
  on the ViewModel — that is the switch built for it.
- **Never look for a `stop()`.** React releases the subscription on unmount; the
  other bindings publish one because their call can happen outside a scope.

## Symptom → cause

| What you see                                   | What it is                                   |
| ---------------------------------------------- | -------------------------------------------- |
| "Maximum update depth exceeded" on first paint | an object selector without `useLankaShallow` |
| the screen never updates, no error             | the tracking blind spot — a derived getter   |
| "Invalid hook call"                            | `useLankaVM` outside a component             |
| a build error about `"use client"`             | this barrel imported from a server component |
| a test sees the previous test's state          | a render that bypassed `renderWithLanka`     |

## More

`reference.md` — the full guide: the tracking rules, the callable spelling in
detail, and what this package deliberately is not.
