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
- why a selector that returns an object needs `useLankaShallow`, and what happens without it
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
import { createLazyLankaVM } from "lanka/viewmodel";

export const useFAQViewModel = toLankaReactVM(
	createLazyLankaVM<IFAQState, IFAQActions>({ … }),
);
```

```tsx
const supportLink = useFAQViewModel((state) => state.supportLink);
const { supportLink, fetchSupportLink } = useFAQViewModel();
useFAQViewModel.getState().trackSupportContacted("faq"); // in a handler, as always
```

That is the entire migration for a codebase on 1.x: one wrapper per ViewModel
file, and not one call site touched.

It works on any ViewModel, however it was built — the factory, the lazy factory,
`ALankaVM`'s `build()`, a shared-store ViewModel — and it wraps ONE store: the
call forwards to `useLankaVM` and every member forwards to the ViewModel, so
notification, access tracking and lazy construction are the ones documented
below. A ViewModel read through this and the same one read in Vue answer
identically.

**Laziness survives.** A lazily declared ViewModel still builds on first use:
reading `useFAQViewModel.name` answers from the config and constructs nothing,
and `dispose` is still there.

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

## A selector that returns an object

`useLankaVM(vm, (state) => ({ … }))` is the commonest thing a React reader
writes, and on its own it does not merely re-render too often — it **crashes on
the first paint**. `useSyncExternalStore` reads the snapshot during render, gets
a fresh object every time, decides the store changed, and renders again:
"Maximum update depth exceeded", with a stack pointing at React rather than at
your selector.

```tsx
import { useLankaShallow, useLankaVM } from "@lankajs/react";

const { title, status } = useLankaVM(
	missionVM,
	useLankaShallow((state) => ({ title: state.title, status: state.status })),
);
```

It compares the selection one level deep — own keys, same count, `Object.is` on
each value, arrays included — and hands back the previous object when nothing in
it moved.

A selector answering a PRIMITIVE was always safe, which is what makes the trap
quiet: the shape that works and the shape that loops look the same on the page.
So the rule is simple — **wrap every selector whose answer is an object or an
array**, and leave the rest alone.

<details><summary><b>Deep dive:</b> why a wrapper and not an equality argument</summary>

`useLankaVM(vm, selector, isEqual)` was the other option, and it puts the
comparison in the binding for every caller — including the ones whose selection
is a string and would pay for a comparison they cannot fail. A wrapper is opt in
at the call site, which is also where a reader can see it. The shape is React's
own: a hook returning a selector, so a consumer arriving from zustand has typed
`useShallow` already.

</details>
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

`@lankajs/react/testing` renders a component with a bootstrapped framework, so a component
test needs no bootstrap preamble of its own:

```tsx
import { renderWithLanka } from "@lankajs/react/testing";

renderWithLanka(<TodoScreen />, {
	fakes: { gateways: { TodoGateway: { list: () => Promise.resolve([]) } } },
});
```

It takes an ELEMENT and not a component, which is React Testing Library's own
shape — the other four bindings take the component, because theirs do.

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
