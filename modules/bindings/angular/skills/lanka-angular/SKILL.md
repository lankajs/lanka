---
name: lanka-angular
description: Read a lanka ViewModel from an Angular component with useLankaVM, declare one that answers a signal already by importing core's six ViewModel factories from @lankajs/angular, give Angular's read to a ViewModel you did not declare — one built by a class — with toLankaCallableVM, split it into a signal per field with toLankaSignals, or hand it to the async pipe and RxJS with toLankaObservable. Use when writing or reviewing an Angular or Analog screen in a lanka application, when declaring a ViewModel an Angular screen will read, when a ViewModel is built by a class extending ALankaVM, when "must be called in an injection context" appears, when a template does not update after state changed, when a service or interceptor needs ViewModel state, or when reviewing code that imports `@lankajs/angular`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/angular
    version: "0.2.0"
---

# @lankajs/angular

One call to read a ViewModel, two Angular-shaped spellings, and one refusal the
other four bindings do not make. `reference.md` beside this file is the full
guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick the call

| The situation                                       | Use                                                |
| --------------------------------------------------- | -------------------------------------------------- |
| a component reads a ViewModel                       | `useLankaVM(todoVM)` — one `Signal`                |
| it needs one derived value                          | `useLankaVM(todoVM, (s) => s.rows.length)`         |
| DECLARING a ViewModel an Angular screen reads       | `createLankaVM` from `@lankajs/angular` — callable |
| a ViewModel you did NOT declare — a CLASS           | `toLankaCallableVM(new RunVM().build())`           |
| a template reads `rows()` per field, like a service | `toLankaSignals(todoVM)`                           |
| the `async` pipe, `combineLatest`, an interceptor   | `toLankaObservable(todoVM)`                        |
| outside an injection context — a handler, a module  | `todoVM.getState()`                                |
| a component test                                    | `renderWithLanka` from `@lankajs/angular/testing`  |

```ts
import { Component } from "@angular/core";
import { useLankaVM } from "@lankajs/angular";
import { todoVM } from "./todoVM";

@Component({
	standalone: true,
	template: `
		@if (state().isLoading) {
			<p>loading</p>
		}
		@for (row of state().rows; track row) {
			<li>{{ row }}</li>
		}
	`,
})
export class TodoScreen {
	protected readonly state = useLankaVM(todoVM);
}
```

It answers a **`Signal`** — Angular's own idea of reactivity, which is the one
thing the shelf does not make uniform. **Zoneless needs no extra step**: a signal
is what zoneless change detection reads. With zones it works unchanged.

## Declaring a ViewModel through this package

The six factory names are core's own — `createLankaVM`, `createLazyLankaVM`,
`createStatelessLankaVM`, `createLazyStatelessLankaVM`,
`createSharedStoreLankaVM`, `createLazySharedStoreLankaVM` — with the same config
and the same generics, so only the import line differs:

```ts
import { createLankaVM } from "@lankajs/angular"; // not "lanka/viewmodel"

export const useTodosVM = createLankaVM<ITodosState, ITodosActions>({ … });
```

```ts
@Component({
	template: `<p>{{ count() }} of {{ state().rows.length }}</p>`,
})
export class TodoScreen {
	protected readonly state = useTodosVM();
	protected readonly count = useTodosVM((todos) => todos.rows.length);
}
```

- **The declaration is at module level, the read is per CALL.** What is
  pre-applied is `useLankaVM` and NOT `toLankaSignals`: the latter asserts an
  injection context the moment it is called, and a declaration runs on import
  where there is none — pre-applying it would make every declaration throw at
  import time.
- **The CALL still needs an injection context.** A field initialiser, a
  constructor, a factory, or `runInInjectionContext`. Not `ngOnInit`.
- **The result is also the ViewModel.** `useTodosVM.getState()`,
  `useTodosVM.subscribe()`, `useTodosVM.name` and `dispose` work outside an
  injection context, and a ViewModel declared with `createLazyLankaVM` still
  builds on first use.
- **Every binding publishes the same six.** The vocabulary does not change
  between frameworks; what the call ANSWERS does — a `Signal` here.
  `TLankaAngularCallableVM` names such a declaration when one has to be
  annotated.
- **`toLankaSignals` and `toLankaObservable` are unchanged** and accept what
  these six answer, because the ViewModel's members are forwarded onto the
  result.

## A signal per field

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
	protected readonly todos = toLankaSignals(todoVM);
}
```

Actions come through as plain functions — `todos.load()` — because an action is
one object for the life of the ViewModel and a signal would make every call site
write `load()()`. There is ONE subscription behind the whole set and each field is
a `computed` over it, so Angular's own deduplication does the rest.

The field list is read once, at the call. A ViewModel declares its state up
front, so that is the whole of it — `useLankaVM` is the answer for a state whose
shape is genuinely dynamic.

## A stream, for the RxJS half

```ts
import { toLankaObservable } from "@lankajs/angular";

@Component({
	template: `@if (todos$ | async; as todos) {
		<p>{{ todos.rows.length }}</p>
	}`,
})
export class TodoScreen {
	protected readonly todos$ = toLankaObservable(todoVM);
}
```

It emits the CURRENT state first, like a `BehaviorSubject`, so `| async` shows
something on the first pass, and each subscriber gets its own recording.

**It needs no injection context**, unlike the two signal spellings: a subscriber
holds its own unsubscribe, which is what `DestroyRef` answers for a signal. So it
works in a service, a resolver, an interceptor and a plain function.

**It imports no `rxjs`.** `AsyncPipe` accepts `Subscribable<T>`, so this
satisfies the contract structurally. Pipe it when you want operators:
`from(toLankaObservable(todoVM))`, or `toObservable` from
`@angular/core/rxjs-interop` over the signal `useLankaVM` answers.

## It must be called in an injection context

A constructor, a field initialiser, a factory, or inside
`runInInjectionContext`. `useLankaVM` and `toLankaSignals` assert it and the
message names the fix.

Stricter than `@lankajs/vue` and `@lankajs/solid`, which publish a `stop()` for a
call outside their framework's scope. Angular cannot: `DestroyRef` is the only
way to learn the caller has gone, and a subscription that cannot learn that is a
leak with no owner. A refusal you read once beats a leak found in production.

## What updates

Without a selector the signal carries a value that RECORDS which keys you read,
and the next change updates it only if one of those moved — so a component
reading `rows` does not repaint because a spinner elsewhere turned off. With a
selector, the selector decides and tracking is bypassed.

> [!WARNING]
> **The blind spot.** Tracking sees keys you read DIRECTLY. A key reached only
> inside a derived getter is invisible to it, so a change to that key updates
> nothing and the screen freezes with no error. Set
> `enableAccessTrackingOptimization: false` on such a ViewModel. Do NOT read the
> underlying keys in the template "for the side effect": that is dead code, and a
> refactor or a lint autofix removes it. In development the framework announces
> the mismatch by ViewModel and key name.

## Testing

```ts
import { renderWithLanka } from "@lankajs/angular/testing";

await renderWithLanka(TodoScreen, {
	fakes: { gateways: { TodoGateway: { list: () => Promise.resolve([]) } } },
});
```

It is `await`ed where the other four bindings' are not: Angular Testing Library
drives `TestBed`, which COMPILES a component rather than merely mounting one.
Every call gets a fresh instance and disposes the previous one.

## A selector that builds an object

A selector answering a fresh object is never identical to its own last answer,
so the reader wakes for EVERY change in the ViewModel — including the keys the
selector exists to ignore. Hold it:

```ts
import { createLankaShallowHold } from "lanka/viewmodel";

private readonly hold = createLankaShallowHold<{ title: string }>();
protected readonly mission = useLankaVM(missionVM, (s) => this.hold({ title: s.title }));
```

One hold per reader, declared as a field ABOVE the read, because initialisers run top to bottom — never at module level and never
shared between two components. A selector answering a **primitive** needs none
of this. The comparison is one level deep: own keys, same count, `Object.is` on
each value, arrays included.

## Never do these

- **Never pass an object-building selector without a hold.** The reader then
  wakes for every change in the ViewModel, selector or no selector.
- **Never call `useLankaVM` or `toLankaSignals` outside an injection context.**
  It throws by design; use `runInInjectionContext`, or `toLankaObservable`, which
  needs none.
- **Never call either in `ngOnInit`.** That is not an injection context — a field
  initialiser or the constructor is.
- **Never forget to await `renderWithLanka`.** It returns a promise, and an
  un-awaited render asserts against a component that has not compiled.
- **Never wrap `toLankaSignals` around a state whose shape changes at runtime.**
  The field list is read once; `useLankaVM` is the answer for that case.
- **Never add `rxjs` as a dependency for `toLankaObservable`.** It is
  structurally a `Subscribable`; `from(…)` gives you the operators.

## Symptom → cause

| What you see                                       | What it is                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| a screen repainting for changes it never selected  | an object selector with no hold                                    |
| "must be called in an injection context"           | the call is in `ngOnInit`, a method or a module                    |
| the template never updates, no error               | the tracking blind spot — a derived getter                         |
| the `async` pipe renders nothing on the first pass | a stream that is not this one — this one replays the current state |
| a test asserting against an empty template         | `renderWithLanka` not awaited                                      |
| a field missing from `toLankaSignals`              | it appeared after the call — read it through `useLankaVM`          |

## More

`reference.md` — the full guide: the three spellings in detail, the injection
context rule, and what this package deliberately is not.
