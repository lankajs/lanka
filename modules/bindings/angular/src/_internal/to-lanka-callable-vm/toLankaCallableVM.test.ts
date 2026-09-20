import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createEnvironmentInjector,
	EnvironmentInjector,
	provideZonelessChangeDetection,
	runInInjectionContext,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { createLankaFakeVM } from "@lankajs/tool-testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { toLankaCallableVM } from "./toLankaCallableVM";

/**
 * The one shape the six factories in `_factories/` are built out of.
 *
 * What is under test is the SEAM, not the reading: `useLankaVM` owns the signal,
 * the tracking and the teardown, and is tested where it lives. Here: that
 * wrapping a ViewModel is safe at module level, that the ViewModel is still
 * there afterwards, and that the read happens per call rather than per
 * declaration.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(resetActiveLanka);

const scope = (): EnvironmentInjector =>
	createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

describe("wrapping a ViewModel", () => {
	it("needs no injection context, which is the whole reason it is `useLankaVM`", () => {
		// `toLankaSignals` asserts an injection context when it is CALLED, and a
		// consumer calls these factories at module level — so pre-applying it would
		// have turned every `export const todoVM = createLankaVM({ … })` into a
		// throw at import time. Nothing here may run Angular's assertion yet.
		const todosVM = createLankaFakeVM({ rows: ["write the canon"] });

		expect(() => toLankaCallableVM(todosVM)).not.toThrow();
	});

	it("hands back the ViewModel's own members, outside any context", () => {
		const todosVM = toLankaCallableVM(createLankaFakeVM({ rows: ["write the canon"] }));

		expect(todosVM.name).toBe("LankaFakeVM");
		expect(todosVM.getState().rows).toEqual([]);
		expect(typeof todosVM.subscribe).toBe("function");

		// `in` answers for the ViewModel too — a devtool and a duck-typed helper
		// ask that way, and the callable is a function underneath.
		expect("getState" in todosVM).toBe(true);
	});
});

describe("the call", () => {
	it("is Angular's read: a signal over the tracked state, inside a context", async () => {
		const rows = ["write the canon", "run the canon"];
		const todosVM = toLankaCallableVM(createLankaFakeVM({ rows }));

		const state = runInInjectionContext(scope(), () => todosVM());

		expect(state().rows).toEqual([]);

		await todosVM.getState().load();

		expect(state().rows).toEqual(rows);
	});

	it("forwards a selector, and answers a signal of the SELECTION", async () => {
		const rows = ["write the canon", "run the canon"];
		const todosVM = toLankaCallableVM(createLankaFakeVM({ rows }));

		const count = runInInjectionContext(scope(), () => todosVM((state) => state.rows.length));

		expect(count()).toBe(0);

		await todosVM.getState().load();

		expect(count()).toBe(rows.length);
	});

	it("still refuses outside an injection context, because the assertion moved and did not go", () => {
		// Invariant 2 of this package is untouched: what changed is WHEN the
		// assertion runs — per call rather than per declaration — not whether it
		// runs at all.
		const todosVM = toLankaCallableVM(createLankaFakeVM({ rows: ["write the canon"] }));

		expect(() => todosVM()).toThrowError(
			/useLankaVM\(\) can only be used within an injection context/,
		);
	});
});
