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

## When to reach for this

Reach for it the moment a React component has to read a lanka ViewModel — that
is the whole job, and there is no other supported way to do it. Install this one
package and no other binding: one application installs one, and `@lankajs/react`
serves React Native too.

You do NOT need it to reach the rest of the framework. Gateways, scenarios and
the locator are plain calls with no view in them, and `viewModel.getState()`
works anywhere, including on a server.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/react react zustand
```

> [!IMPORTANT]
> `react` is already in your project; `zustand` is `lanka`'s own peer. npm adds
> a missing peer for you and pnpm does not, so the line names all of them.

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
writes, and it is safe: the binding runs a selector once per state object and
holds the answer, so the two snapshot reads of one commit see the same
reference.

What it does NOT get on its own is the thing you took a selector for. A fresh
object is new whenever the state is new, so the component wakes for **every**
change in the ViewModel — including the keys your selector exists to ignore.
`useLankaShallow` is the comparison that makes the selection mean something:

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

The comparison itself is `createLankaShallowHold` in `lanka/viewmodel`, and every
binding on the shelf can reach it. React gets a hook over it because React needs
one: a component re-runs `useLankaShallow` on every render, so the holding has to
survive a render while the selector stays the current one — which is what makes a
selection computed from props safe here. Use the hook; the core name is what the
other four bindings write.

A selector answering a PRIMITIVE never needed it, which is what makes the cost
quiet: the shape that is free and the shape that repaints on everything look the
same on the page. So the rule is simple — **wrap every selector whose answer is
an object or an array**, and leave the rest alone.

> [!NOTE]
> This used to be worse. Until the binding held the selection, an unwrapped
> object selector **crashed on the first paint** with "Maximum update depth
> exceeded" and a stack pointing at React rather than at your selector. If you
> are reading that message in an older version, this is what it was.

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

## Recap

- `useLankaVM(todoVM)` is the one call, and every binding publishes that name — a screen written with it moves between frameworks unedited.
- Without a selector you get a value that records which keys you read, and only those keys re-render you.
- A key reached only through a derived getter is invisible to tracking: set `enableAccessTrackingOptimization: false` on that ViewModel rather than patching the view.
- Wrap every selector whose answer is an object or an array in `useLankaShallow`; a primitive selector needs nothing.
- `toLankaReactVM` hands back the `useTodoVM()` spelling for a 1.x codebase, over the same store and with no behaviour of its own.
- The barrel is `"use client"` and `lanka/viewmodel` is not, so a server component may read state and only what renders it is a client component.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/bindings/react/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/bindings/react/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
