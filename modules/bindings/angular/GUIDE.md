# @lankajs/angular — user guide

How an Angular component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- how to declare a ViewModel that answers a signal already, by changing one import line
- when a component updates and when it deliberately does not
- why a selector that builds an object needs a hold, and when it needs nothing
- why this binding refuses a call the other four merely warn about
- how to test an Angular component with a live framework behind it

## When to reach for this

Reach for it the moment an Angular component has to read a lanka ViewModel — that
is the whole job, and there is no other supported way to do it. Install this one
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
npm install @lankajs/angular @angular/core zustand
```

> [!IMPORTANT]
> `@angular/core` is already in your project; `zustand` is `lanka`'s own peer.
> Zoneless needs no extra step — a signal is what zoneless change detection
> reads. npm adds a missing peer for you and pnpm does not, so the line names
> all of them.

## The one call

`useLankaVM` is a function. Every member of `modules/bindings/` publishes that
same name, so moving a screen from one framework to another rewrites the view and
not the vocabulary.

```ts
import { Component } from "@angular/core";
import { useLankaVM } from "@lankajs/angular";
import { todoVM } from "./todoVM";

@Component({
	standalone: true,
	template: `
		<p *ngIf="state().isLoading">loading</p>
		<ul *ngIf="!state().isLoading">
			<li *ngFor="let row of state().rows">{{ row }}</li>
		</ul>
	`,
})
export class TodoScreen {
	protected readonly state = useLankaVM(todoVM);
}
```

It answers a **`Signal`** — the one thing this shelf does not make uniform,
because that is Angular's own idea of reactivity and a binding that hid it would
be a second reactivity system fighting the first.

**Zoneless needs no extra step.** A signal is what zoneless change detection
reads, so this is the shape Angular is moving towards rather than a bridge to it.
With zones it works unchanged.

## Declaring a ViewModel that answers a signal already

A ViewModel is declared once, at module level, and read wherever a component
needs it. This package publishes core's six ViewModel factories under **core's
own names**, each already wearing Angular's read:

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
import { createLankaVM } from "@lankajs/angular";

export const useTodosVM = createLankaVM<ITodosState, ITodosActions>({ … });
```

A component then calls the declaration, with a selector or without, instead of
passing it to `useLankaVM`:

```ts
import { Component } from "@angular/core";
import { useTodosVM } from "./todosVM";

@Component({
	standalone: true,
	template: `
		<p>{{ count() }} rows</p>
		@for (row of state().rows; track row) {
			<li>{{ row }}</li>
		}
	`,
})
export class TodoScreen {
	protected readonly state = useTodosVM();
	protected readonly count = useTodosVM((todos) => todos.rows.length);
}
```

Every member of this shelf publishes the same six names, so the vocabulary does
not change when a screen moves between frameworks. What changes is what the call
ANSWERS — a `Signal` here, a `ShallowRef` in Vue, an `Accessor` in Solid, the
state itself in React — because that is the framework's own idea of reactivity.
`TLankaAngularCallableVM` is the type naming Angular's answer, for a declaration
that has to be annotated or passed on.

> [!IMPORTANT]
> The factory runs at the DECLARATION and the read happens at the CALL. That is
> why what is pre-applied is `useLankaVM` and not `toLankaSignals`: the latter
> asserts an injection context the moment it is called, and a declaration runs at
> module level, on import, where there is none — pre-applying it would turn every
> `export const useTodosVM = createLankaVM({ … })` into a throw on import.
>
> The assertion still holds, moved to where it belongs: **the CALL must be in an
> injection context** — a field initialiser, a constructor, a factory, or inside
> `runInInjectionContext` — because that is where `DestroyRef` can learn the
> caller has gone.

**The result is also the ViewModel.** `useTodosVM.getState()`,
`useTodosVM.subscribe()`, `useTodosVM.name` and `dispose` all work outside an
injection context — the members are forwarded rather than copied — and a
ViewModel declared with `createLazyLankaVM` still builds on first use: reading
its `name` answers from the config and constructs nothing.

`toLankaSignals` and `toLankaObservable` are untouched by any of this. They keep
their own names and their own shapes, `toLankaSignals` still requires an
injection context of its own, and both ACCEPT what these six answer, precisely
because the ViewModel's members are forwarded onto the result.

## A signal per field, the way a service exposes state

`useLankaVM` answers ONE `Signal` over the whole state, which is the shape every
other binding on the shelf parallels: `state().rows`.

An Angular service exposes a signal per field and a template reads `rows()`, so
this package publishes that too:

```ts
import { toLankaSignals } from "@lankajs/angular";

@Component({
	template: `
		@if (todos.isLoading()) {
			<p>loading</p>
		}
		@for (row of todos.rows(); track row) {
			<li>{{ row }}</li>
		}
	`,
})
export class TodoScreen {
	protected readonly todos = toLankaSignals(todosVM);
}
```

Actions come through as plain functions — `todos.load()` — because an action is
one object for the life of the store and a signal would make every call site
write `load()()`.

There is ONE subscription behind the whole set, and each field is a `computed`
over it, so Angular's own deduplication does the rest: a `computed` whose value
has not changed notifies nobody.

The field list is read once, at the call. A ViewModel declares its state up
front, so that is the whole of it — and `useLankaVM` is the answer for a state
whose shape is genuinely dynamic.

It must be called in an injection context, for the reason `useLankaVM` must:
`DestroyRef` is the only way to learn the caller has gone.

## A stream, for the half of Angular that speaks RxJS

Angular is signals-first and `useLankaVM` and `toLankaSignals` answer signals,
which is the right default. It is also a framework with fifteen years of
`Observable` in it — the `async` pipe, `HttpClient`, the router's events, every
`switchMap` a codebase already has — and a signal is not something you can pass
to `combineLatest`.

```ts
import { toLankaObservable } from "@lankajs/angular";

@Component({
	template: `@if (todos$ | async; as todos) {
		…
	}`,
})
export class TodoScreen {
	protected readonly todos$ = toLankaObservable(todosVM);
}
```

It emits the CURRENT state first, like a `BehaviorSubject`, so a template
rendering `| async` shows something on the first pass. Each subscriber gets its
own recording, so a subscriber reading only `rows` is not woken by `unread`.

**It needs no injection context**, unlike the two signal spellings: a stream's
subscriber holds its own unsubscribe, which is RxJS's answer to the question
`DestroyRef` answers for a signal. So it works in a service, a resolver, an
interceptor and a plain function.

**It imports no `rxjs`.** `AsyncPipe` accepts `Subscribable<T>` — one method — so
this satisfies the contract structurally and `@lankajs/angular` goes on importing
nothing but `@angular/core`. Pipe it when you want the operators:
`from(toLankaObservable(vm))` takes a subscribable, and `toObservable` from
`@angular/core/rxjs-interop` takes the signal `useLankaVM` answers.

## What updates, and what does not

Without a selector the signal carries a value that RECORDS which keys you read.
The next change updates it only if one of those moved — so a component reading
`rows` does not repaint because a spinner somewhere else turned off.

With a selector, the selector decides and tracking is bypassed:

```ts
protected readonly count = useLankaVM(todoVM, (state) => state.rows.length);
```

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter — an action calling `get()` — is invisible to it, so a
> change to that key updates nothing and the screen freezes with no error.
>
> Set `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT patch
> it in the template by reading the underlying keys "for the side effect": that
> is dead code, and a refactor or a lint autofix removes it.
>
> In development the framework announces the mismatch by ViewModel and key name.

## A selector that builds its answer

`useLankaVM(vm, (state) => ({ … }))` is safe — nothing loops — but on its own it
updates the signal for **every** change in the ViewModel, including the keys the
selector exists to ignore. The reason is identity: that object is new on every
call, and a binding compares selections with `Object.is`.

`createLankaShallowHold` is the comparison that fixes it. It answers the
PREVIOUS object while nothing in the selection moved, one level deep — own keys,
same count, `Object.is` on each value, arrays included:

```ts
import { createLankaShallowHold } from "lanka/viewmodel";
import { useLankaVM } from "@lankajs/angular";

@Component({
	template: `<h1>{{ mission().title }} — {{ mission().status }}</h1>`,
})
export class MissionScreen {
	private readonly hold = createLankaShallowHold<{ title: string; status: string }>();

	protected readonly mission = useLankaVM(missionVM, (state) =>
		this.hold({ title: state.title, status: state.status }),
	);
}
```

The hold is declared ABOVE the read, because field initialisers run top to
bottom. One per component — never a `static`, and never shared between two of
them, because the answer it holds belongs to whoever selected it.

A selector answering a **primitive** needs none of this: `(state) => state.title`
compares equal to itself and was always free. A selection with a **nested**
object wants a selector that picks the leaves — comparing deeper would mean
walking a state of unknown size on every read, which is the cost a selector was
taken to avoid.

## It must be called in an injection context

A constructor, a field initialiser, a factory, or inside
`runInInjectionContext`. This binding asserts it, and the message names the fix.

That is stricter than `@lankajs/vue` and `@lankajs/solid`, which publish a
`stop()` for a call made outside their framework's scope. Their reason is that
both can still work without one. Angular cannot: `DestroyRef` is the only way to
learn that the caller has gone, and a subscription that cannot learn that is a
leak with no owner.

So this one refuses at the call rather than leaking quietly — a refusal you read
once beats a leak found in production.

## Testing

`@lankajs/angular/testing` renders a component with a bootstrapped framework, so
a component test needs no bootstrap preamble of its own:

```ts
import { renderWithLanka } from "@lankajs/angular/testing";

await renderWithLanka(TodoScreen, {
	fakes: { gateways: { TodoGateway: { list: () => Promise.resolve([]) } } },
});
```

It is `await`ed where the other four bindings' are not: Angular Testing Library
drives `TestBed`, which COMPILES a component rather than merely mounting one.
That difference belongs to Angular's testing story and not to lanka, which is why
it is not hidden behind a synchronous wrapper.

Every call gets a FRESH instance and disposes the previous one, so a test never
inherits its neighbour's subscriptions.

## What this package is not

It is a subscription and a signal, and nothing else. The recording of which keys
you read, the comparison that decides whether a change is worth an update, and
the blind-spot warning are all in `lanka` itself — which is why the behaviour you
see is the framework's rather than this package's reading of it, and why
`lankaViewBindingConformance` can hold every binding to one list.

If this package ever needs more than the ViewModel port gives it, the port has
the defect and the fix belongs in `lanka`, for every framework at once.

## Recap

- `useLankaVM(todoVM)` is the one call, and every binding publishes that name.
- It answers a read-only `Signal`: `state().rows` in a component, `{{ state().rows }}` in a template.
- It must be called in an injection context, and it says so: `DestroyRef` is the only way to learn the caller has gone.
- A key reached only through a derived getter is invisible to tracking: set `enableAccessTrackingOptimization: false` on that ViewModel.
- This package publishes core's six ViewModel factories under core's own names, already callable — a declaration moves by changing its import line, and every binding publishes the same six.
- `toLankaSignals` gives a signal per field; `toLankaObservable` is the bridge for code that already speaks RxJS; both accept what those six answer.
- `renderWithLanka` from `@lankajs/angular/testing` drives `TestBed`, so a field initialiser is inside an injection context in a test too.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../../README.md](../../../README.md)
