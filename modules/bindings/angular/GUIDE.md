# @lankajs/angular — user guide

How an Angular component reads a lanka ViewModel.

## You will learn

- the one call this package publishes, and what it answers
- when a component updates and when it deliberately does not
- why this binding refuses a call the other four merely warn about
- how to test an Angular component with a live framework behind it

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
