<!-- Generated from modules/bindings/solid/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/solid@0.2.1`** — this document describes that version.
>
> Install: `npm install @lankajs/solid solid-js zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/bindings/solid/_playground/playground.test.tsx](https://github.com/lankajs/lanka/blob/main/modules/bindings/solid/_playground/playground.test.tsx)

# @lankajs/solid — user guide

How a Solid component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- how to declare a ViewModel that is an accessor already, by changing one import line
- when a component re-renders and when it deliberately does not
- why a selector that builds an object needs a hold, and when it needs nothing
- what to do about a ViewModel that derives what the screen shows
- how to test a Solid component with a live framework behind it

## When to reach for this

Reach for it the moment a Solid component has to read a lanka ViewModel — that
is the whole job, and there is no other supported way to do it. Install this one
package and no other binding: the five are alternatives, not layers.

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
npm install @lankajs/solid solid-js zustand
```

> [!IMPORTANT]
> `solid-js` is already in your project; `zustand` is `lanka`'s own peer. npm
> adds a missing peer for you and pnpm does not, so the line names all of them.

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

## Declaring a ViewModel that is an accessor already

A ViewModel is declared once, at module level, and read wherever a component
needs it. This package publishes core's six ViewModel factories under **core's
own names**, each already wearing Solid's read:

|                          |                                |
| ------------------------ | ------------------------------ |
| `createLankaVM`          | `createSharedStoreLankaVM`     |
| `createLazyLankaVM`      | `createLazySharedStoreLankaVM` |
| `createStatelessLankaVM` | `createLazyStatelessLankaVM`   |

Same config, same generics, same ViewModel. The difference is the import line:

```ts
// todosVM.ts — before: the framework-free declaration
import { createLankaVM } from "lanka/viewmodel";

export const todosVM = createLankaVM<ITodosState, ITodosActions>({ … });

// todosVM.ts — after: the same declaration, read by calling it
import { createLankaVM } from "@lankajs/solid";

export const useTodosVM = createLankaVM<ITodosState, ITodosActions>({ … });
```

A component then calls the declaration, with a selector or without, instead of
passing it to `useLankaVM`:

```tsx
import { For } from "solid-js";
import { useTodosVM } from "./todosVM";

export const TodoScreen = () => {
	const state = useTodosVM();
	const count = useTodosVM((todos) => todos.rows.length);

	return (
		<>
			<p>{count()} selected</p>
			<For each={state().rows}>{(row) => <li>{row}</li>}</For>
		</>
	);
};
```

Every member of this shelf publishes the same six names, so the vocabulary does
not change when a screen moves between frameworks. What changes is what the call
ANSWERS — a `TLankaVMAccessor` here, a `ShallowRef` in Vue, a `Signal` in
Angular, the state itself in React — because that is the framework's own idea of
reactivity. `TLankaSolidCallableVM` is the type naming Solid's answer, for a
declaration that has to be annotated or passed on.

> [!IMPORTANT]
> The factory runs at the DECLARATION and the read happens at the CALL, inside
> the owner that made it. That is why what is pre-applied is `useLankaVM` and not
> `toLankaSolidVM`: the latter calls `createSignal` and `onCleanup`, so applying
> it at module level — where there is no owner — would open ONE subscription
> nobody can release and hand every component on the screen the same one.

**The result is also the ViewModel.** `useTodosVM.getState()`,
`useTodosVM.subscribe()`, `useTodosVM.name` and `dispose` all work outside a
component — the members are forwarded rather than copied — and a ViewModel
declared with `createLazyLankaVM` still builds on first use: reading its `name`
answers from the config and constructs nothing.

`toLankaSolidVM` is untouched by any of this. It keeps its own name, it must
still be called inside an owner, and it ACCEPTS what these six answer, precisely
because the ViewModel's own members are forwarded onto the result.

### A ViewModel you did not declare

The six names above declare a ViewModel THROUGH this package. Reach for
`toLankaCallableVM` when the declaration is somebody else's: one built by a
CLASS, one a library handed over, or one declared with `lanka/viewmodel` because
a server component must read it.

```ts
import { toLankaCallableVM } from "@lankajs/solid";
import { ALankaVM } from "lanka/viewmodel";

class RunVM extends ALankaVM<IRunState, IRunActions> {
	protected readonly name = "RunVM";

	protected override states(): IRunState {
		return { rows: [] };
	}

	protected createActions(): IRunActions {
		return { clear: () => this.set({ rows: [] }) };
	}
}

export const useRunVM = toLankaCallableVM(new RunVM().build());
```

What comes back is exactly what the six factories answer, so everything this
section says still holds: the call takes a selector or none, the ViewModel's own
members are forwarded rather than copied, and a lazy declaration stays lazy.

**Every binding on this shelf publishes this same name**, so the vocabulary does
not change between frameworks — a class ViewModel is wrapped the same way in
React, Vue, Svelte, Solid and Angular, and only what the call ANSWERS differs — an `Accessor` here.

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

`$stop` is the one member it adds, `$`-prefixed so it cannot collide with a
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

## A selector that builds its answer

`useLankaVM(vm, (state) => ({ … }))` is safe — nothing loops — but on its own it
wakes the reader for **every** change in the ViewModel, including the keys the
selector exists to ignore. The reason is identity: that object is new on every
call, and a binding compares selections with `Object.is`.

`createLankaShallowHold` is the comparison that fixes it. It answers the
PREVIOUS object while nothing in the selection moved, one level deep — own keys,
same count, `Object.is` on each value, arrays included:

```tsx
import { createLankaShallowHold } from "lanka/viewmodel";
import { useLankaVM } from "@lankajs/solid";

export const MissionScreen = () => {
	const hold = createLankaShallowHold<{ title: string; status: string }>();
	const mission = useLankaVM(missionVM, (state) =>
		hold({ title: state.title, status: state.status }),
	);

	return (
		<h1>
			{mission().title} — {mission().status}
		</h1>
	);
};
```

One hold per reader, created inside the component beside the read — never at
module level and never shared between two of them, because the answer it holds
belongs to whoever selected it.

A selector answering a **primitive** needs none of this: `(state) => state.title`
compares equal to itself and was always free. A selection with a **nested**
object wants a selector that picks the leaves — comparing deeper would mean
walking a state of unknown size on every read, which is the cost a selector was
taken to avoid.

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

## Recap

- `useLankaVM(todoVM)` is the one call, and every binding publishes that name.
- It answers an `Accessor`: `state().todos`. That difference is Solid's, and the shelf does not hide it.
- Tracking still earns its place: without it every change writes a new object into the signal and every effect reading any part of it re-runs.
- A key reached only through a derived getter is invisible to tracking: set `enableAccessTrackingOptimization: false` on that ViewModel.
- This package publishes core's six ViewModel factories under core's own names, already callable — a declaration moves by changing its import line, and every binding publishes the same six.
- `toLankaSolidVM` reads the way a Solid store does, for the read half only — writes stay in the ViewModel's actions, and it accepts what those six answer.
- Inside a component or a root the subscription is released for you; outside one, `$stop()` is yours to call.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/bindings/solid/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/bindings/solid/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
