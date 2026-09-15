<!-- Generated from modules/bindings/react/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/react@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/react react zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/bindings/react/_playground/playground.test.tsx](https://github.com/lankajs/lanka/blob/main/modules/bindings/react/_playground/playground.test.tsx)

# @lankajs/react — user guide

How a React component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- how to keep React's familiar `useTodoVM()` spelling, if you had it
- when a component re-renders and when it deliberately does not
- what to do about a ViewModel that derives what the screen shows
- how to test a React component with a live framework behind it

## The one call

`useLankaVM` is a hook. Every member of `modules/bindings/` publishes that same
name, so moving a screen from one framework to another rewrites the view and not
the vocabulary.

```tsx
import { useLankaVM } from "@lankajs/react";
import { todoVM } from "./todoVM";

export const TodoScreen = () => {
	const { todos, isLoading, load } = useLankaVM(todoVM);

	if (isLoading) return <p>loading</p>;

	return (
		<ul onClick={() => void load()}>
			{todos.map((todo) => (
				<li key={todo.id}>{todo.title}</li>
			))}
		</ul>
	);
};
```

It answers **the state itself** — the one thing this shelf does not make uniform,
because that is React's own idea of reactivity and a binding that hid it
would be a second reactivity system fighting the first.

## The React spelling, if you prefer it

Until 2.0 a ViewModel WAS a hook: `createLankaVM` answered a callable, and every
screen called it. Core cannot do that any more — it may not know what a hook is —
but this package may, and it does:

```ts
import { toLankaReactVM } from "@lankajs/react";
import { createLankaVM } from "lanka/viewmodel";

const todoVM = createLankaVM({ … }); // framework-free, as Vue and Svelte get it

export const useTodoVM = toLankaReactVM(todoVM); // the same object, callable
```

```tsx
const { todos, load } = useTodoVM();
const count = useTodoVM((state) => state.todos.length);
const todos = useTodoVM.getState().todos; // outside a component, as always
```

It works on any ViewModel, however it was built — the factory, `ALankaVM`'s
`build()`, or a shared-store ViewModel — and it wraps ONE store: the call
forwards to `useLankaVM` and every member forwards to the ViewModel, so
notification, access tracking and lazy construction are the ones documented
below. A ViewModel read through this and the same one read in Vue answer
identically.

Which spelling to use is taste, with one thing to weigh: `useLankaVM(todoVM)` is
what the other four bindings publish, so a screen written that way moves between
frameworks unedited. `toLankaReactVM` is for a React codebase that already has
hundreds of `useTodoVM()` call sites, and for one that simply prefers them.

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

React releases the subscription when the component unmounts, and there is
nothing for you to call: a hook cannot be used outside a component, so the case
the other bindings publish a `stop` for cannot arise here.

## Server components

`lanka/viewmodel` carries no `"use client"` — a ViewModel is a store, and a
server component may read its state with `todoVM.getState()`. This package's
barrel does carry the directive, because `useLankaVM` is a hook. So the split is
the useful one: a server component reads, and only what RENDERS is a client
component.

```tsx
// app/page.tsx — a server component
import { todoVM } from "./todoVM";

export default function Page() {
	return <TodoScreen initial={todoVM.getState().todos} />;
}
```

## Testing

`@react/testing` renders with a bootstrapped framework, so a component
test needs no bootstrap preamble of its own:

```ts
import { renderWithLanka } from "@lankajs/react/testing";

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
