import { createLankaViewSubscription } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** What a subscriber hands in, and what it gets back. */
export interface ILankaObserver<TValue> {
	next?: (value: TValue) => void;
	error?: (failure: unknown) => void;
	complete?: () => void;
}

/** What unsubscribing looks like, in RxJS's own vocabulary. */
export interface ILankaUnsubscribable {
	unsubscribe: () => void;
}

/**
 * A ViewModel as something the `async` pipe and an RxJS chain accept.
 *
 * `Subscribable` is the whole contract: one method, and `AsyncPipe` takes it as
 * readily as an `Observable`.
 */
export interface ILankaObservableVM<TState extends object> {
	subscribe: (
		observer: ILankaObserver<TState> | ((value: TState) => void),
	) => ILankaUnsubscribable;
}

/**
 * Reads a ViewModel as a stream, for the half of Angular that speaks RxJS.
 *
 * ```ts
 * @Component({ template: `@if (todos$ | async; as todos) { … }` })
 * export class TodoScreen {
 * 	protected readonly todos$ = toLankaObservable(todosVM);
 * }
 * ```
 *
 * ```ts
 * // or in a chain, where signals cannot go
 * toLankaObservable(todosVM).subscribe(({ rows }) => this.log(rows.length));
 * ```
 *
 * ## Why this exists beside `useLankaVM` and `toLankaSignals`
 *
 * Angular is signals-first now and those two answer signals, which is the right
 * default. It is also a framework with fifteen years of `Observable` in it: the
 * `async` pipe, `HttpClient`, the router's events, every `switchMap` a codebase
 * already has. A consumer with a stream in hand reaches for `combineLatest`, and
 * a signal is not something they can pass to it.
 *
 * ## No `rxjs` import, deliberately
 *
 * `AsyncPipe` accepts `Subscribable<T>`, which is an INTERFACE — one method — so
 * this satisfies it structurally and adds no dependency. The parity canon's
 * order for an idiom is the framework's own library first, then what it already
 * requires, then a few lines written here, and only then somebody else's
 * package. This is the third rung, and it keeps `@lankajs/angular` importing
 * nothing but `@angular/core`.
 *
 * A consumer who wants the operators pipes it: `from(toLankaObservable(vm))`
 * takes a subscribable, and `toObservable` from `@angular/core/rxjs-interop`
 * takes the signal `useLankaVM` answers.
 *
 * ## It emits the CURRENT state first
 *
 * Like a `BehaviorSubject` and like every store an Angular consumer has met: a
 * subscriber gets the state it subscribed to before anything changes, because a
 * template rendering `| async` would otherwise show nothing until the first
 * write.
 *
 * ## No injection context needed
 *
 * Unlike `useLankaVM` and `toLankaSignals`, which take a `DestroyRef` because a
 * signal has no other way to learn its reader has gone. A stream's subscriber
 * holds its own unsubscribe, which is RxJS's answer to the same question — so
 * this works in a service, a resolver, an interceptor and a plain function.
 */
export const toLankaObservable = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): ILankaObservableVM<TState> => ({
	subscribe: (observer) => {
		const next =
			typeof observer === "function" ? observer : (observer.next ?? (() => undefined));

		const view = createLankaViewSubscription(viewModel, () => next(view.read()));

		next(view.read());

		return { unsubscribe: view.stop };
	},
});
