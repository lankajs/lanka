# @lankajs/solid — user guide

How a Solid component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component re-renders and when it deliberately does not
- what to do about a ViewModel that derives what the screen shows
- how to test a Solid component with a live framework behind it

## The one call

`useLankaVM` is a function. Every member of `modules/bindings/` publishes that same
name, so moving a screen from one framework to another rewrites the view and not
the vocabulary.

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

It answers **an `Accessor`** — the one thing this shelf does not make uniform,
because that is Solid's own idea of reactivity and a binding that hid it
would be a second reactivity system fighting the first.

## Reading it the way Solid reads an object

`useLankaVM` answers an `Accessor`, which is Solid's own shape for a value and
the one every other binding on the shelf parallels: `state().rows`.

It is not how Solid holds an OBJECT. `createStore` gives a proxy read as
`state.rows` — no call, and the read itself is the subscription — so this package
publishes the read half of that shape:

```tsx
import { toLankaSolidVM } from "@lankajs/solid";

const todos = toLankaSolidVM(todosVM);

<For each={todos.rows}>{(row) => <li>{row}</li>}</For>;
```

The read registers the surrounding computation with Solid AND records the key in
the access tracker, in one access — so a view that never read `unread` is not
re-run when it moves.

It is the read half only. Solid's store is a write path as well, and a
ViewModel's writes belong to its actions; a `setStore` beside them would be a
second place state changes.

`$stop` is the one member it adds, `# @lankajs/solid — user guide

How a Solid component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component re-renders and when it deliberately does not
- what to do about a ViewModel that derives what the screen shows
- how to test a Solid component with a live framework behind it

## The one call

`useLankaVM` is a function. Every member of `modules/bindings/` publishes that same
name, so moving a screen from one framework to another rewrites the view and not
the vocabulary.

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

It answers **an `Accessor`** — the one thing this shelf does not make uniform,
because that is Solid's own idea of reactivity and a binding that hid it
would be a second reactivity system fighting the first.

## Reading it the way Solid reads an object

`useLankaVM` answers an `Accessor`, which is Solid's own shape for a value and
the one every other binding on the shelf parallels: `state().rows`.

It is not how Solid holds an OBJECT. `createStore` gives a proxy read as
`state.rows` — no call, and the read itself is the subscription — so this package
publishes the read half of that shape:

```tsx
import { toLankaSolidVM } from "@lankajs/solid";

const todos = toLankaSolidVM(todosVM);

<For each={todos.rows}>{(row) => <li>{row}</li>}</For>;
```

The read registers the surrounding computation with Solid AND records the key in
the access tracker, in one access — so a view that never read `unread` is not
re-run when it moves.

-prefixed so it cannot collide with a
state key. An owner releases the subscription for you; a reader built outside
one has none, so that call is yours.

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

Inside a component or a root, `onCleanup` releases the subscription with the
owner and you do nothing. Called outside one there is no owner, so the accessor
carries `stop()` and you own it.

## Why tracking earns its place in a framework that already skips work

Solid re-runs only what a changed signal fed, so a coarse binding would be less
wrong here than elsewhere. It would still be wrong: without tracking, every
change writes a new object into the signal and every expression reading ANY part
of it re-runs. The tracker is what keeps the signal UNCHANGED when nothing you
read moved — and an unchanged signal is work Solid never starts.

## Testing

`@lankajs/solid/testing` renders a component with a bootstrapped framework, so a component
test needs no bootstrap preamble of its own:

```ts
import { renderWithLanka } from "@lankajs/solid/testing";

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
