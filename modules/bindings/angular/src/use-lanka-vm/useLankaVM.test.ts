import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createEnvironmentInjector,
	EnvironmentInjector,
	effect,
	provideZonelessChangeDetection,
	runInInjectionContext,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { useLankaVM } from "./useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * What is Angular-specific about `useLankaVM`, and unproven anywhere else.
 *
 * The conformance suite (`_playground/conformance.test.ts`) already holds this
 * binding to the scenes every member of the shelf answers — first render,
 * tracked re-render, unmount, selectors, all six ViewModel shapes and the rest.
 * What is here instead is the one place this binding STOPS rather than degrades,
 * how its subscription's lifetime is actually wired to `DestroyRef`, what shape
 * the return value itself is, and why the signal it hands back is built with
 * `equal: () => false`.
 */

const titles = (): readonly string[] => ["write the canon", "run the canon"];

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(resetActiveLanka);

describe("refusing to run outside an injection context", () => {
	it("names ITSELF in the thrown message, so a reader is pointed at the fix", () => {
		// `@lankajs/vue` and `@lankajs/solid` publish a `stop()` for this same case
		// and keep working; Angular has no other way to learn the caller is gone, so
		// this is the one binding on the shelf that refuses rather than leaks. The
		// message is `assertInInjectionContext(useLankaVM)`'s own — naming the
		// function is what turns a thrown error into a fix a reader can find.
		const todosVM = createLankaFakeVM({ rows: titles() });

		expect(() => useLankaVM(todosVM)).toThrowError(
			/useLankaVM\(\) can only be used within an injection context/,
		);
	});
});

describe("what the call hands back", () => {
	it("is READONLY: a caller cannot `set` the signal it was given", () => {
		// `asReadonly()` is the whole of the promise, not a habit: a `WritableSignal`
		// carries `.set` and `.update`, and the readonly wrapper Angular hands back
		// from `asReadonly()` carries neither — so their absence here is the type
		// Angular itself gives a caller who tries to write it.
		const todosVM = createLankaFakeVM({ rows: titles() });
		const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

		const state = runInInjectionContext(scope, () => useLankaVM(todosVM));
		const writable = state as unknown as { set?: unknown; update?: unknown };

		expect(writable.set).toBeUndefined();
		expect(writable.update).toBeUndefined();
	});

	it("answers a signal of the SELECTION, not of the whole state, when given a selector", async () => {
		const todosVM = createLankaFakeVM({ rows: titles() });
		const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

		const count = runInInjectionContext(scope, () =>
			useLankaVM(todosVM, (state) => state.rows.length),
		);

		expect(count()).toBe(0);

		await todosVM.getState().load();

		// Read directly, with no effect in between: the signal's own stored value
		// moved, which is a claim about `useLankaVM`'s return shape rather than
		// about whatever later reads it.
		expect(count()).toBe(titles().length);
	});
});

describe("the subscription's lifetime", () => {
	it("is released by DestroyRef: destroying the injector stops the underlying subscription", () => {
		/*
		 * Read directly off the SIGNAL, with no `effect()` in the middle. An
		 * effect is itself torn down when its OWN injector is destroyed — Angular
		 * does that regardless of whether `useLankaVM` ever called `DestroyRef`
		 * — so counting effect runs would prove the injector API works and say
		 * nothing about this function's own `inject(DestroyRef).onDestroy(stop)`.
		 * Counting how many of the store's own notifications still reach the
		 * signal is what actually pins that line: comment it out and the second
		 * `bump()` below still lands.
		 */
		let current = { count: 0 };
		const listeners = new Set<(next: { count: number }, prev: { count: number }) => void>();
		const counterVM: ILankaReadableVM<{ count: number }> = {
			name: "CounterVM",
			isAccessTracked: true,
			getState: () => current,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};
		const bump = (): void => {
			const prev = current;
			current = { count: prev.count + 1 };
			for (const listener of listeners) listener(current, prev);
		};

		const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
		const state = runInInjectionContext(scope, () => useLankaVM(counterVM));
		void state().count; // the key this reader depends on, the way a template reads it

		bump();
		expect(state().count).toBe(1);

		scope.destroy();
		bump();

		expect(state().count).toBe(1);
	});
});

describe("why the signal is built with `equal: () => false`", () => {
	it("re-runs an effect after a tracked change, even though the value is reference-identical", () => {
		/*
		 * The access tracker caches its proxy by the IDENTITY of the state it
		 * wraps (`createLankaAccessTracker`'s `trackedReadOf`): a ViewModel that
		 * never replaces that reference — one that mutates a single object in
		 * place, which `ILankaReadableVM` does not forbid — hands back the exact
		 * SAME proxy on every read. A signal comparing by identity would then see
		 * every `.set()` after the first as a no-op and stop notifying, which is
		 * precisely the case a reader that has read no KEY yet must not be denied:
		 * `shouldNotify` answers `true` unconditionally for it.
		 *
		 * Removing `equal: () => false` from `useLankaVM` turns this red: `runs`
		 * would stay at its first value forever, because the signal would refuse
		 * every later `.set()` of that same reference.
		 */
		interface IMutatingState {
			watched: number;
		}

		const state: IMutatingState = { watched: 0 };
		const listeners = new Set<(next: IMutatingState, prev: IMutatingState) => void>();
		const mutatingVM: ILankaReadableVM<IMutatingState> = {
			name: "MutatingVM",
			isAccessTracked: true,
			getState: () => state,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};

		const scope = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
		let runs = 0;

		runInInjectionContext(scope, () => {
			const signalOfState = useLankaVM(mutatingVM);
			effect(() => {
				runs += 1;
				// Reading the SIGNAL and nothing off it: a reader that has recorded
				// no key yet, which is exactly the `keys.size === 0` case the tracker
				// answers by notifying regardless of what a value comparison would say.
				void signalOfState();
			});
		});
		TestBed.flushEffects();
		const before = runs;

		state.watched += 1;
		for (const listener of listeners) listener(state, state);
		TestBed.flushEffects();

		expect(runs).toBeGreaterThan(before);
	});
});
