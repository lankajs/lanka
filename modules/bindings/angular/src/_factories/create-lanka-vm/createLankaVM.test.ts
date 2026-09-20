import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createEnvironmentInjector,
	EnvironmentInjector,
	provideZonelessChangeDetection,
	runInInjectionContext,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { createLankaVM } from "./createLankaVM";

/**
 * The declaration site, in one line.
 *
 * What is under test is not the reading — `useLankaVM` and `toLankaCallableVM`
 * own that and are tested where they live. It is the promise these six names
 * make: core's factory, core's config, core's ViewModel, already wearing
 * Angular's read, so a consumer moves a declaration by changing the import line.
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

interface ITodoState {
	todos: readonly string[];
	filter: string;
}

interface ITodoActions {
	add: (todo: string) => void;
}

const config = () => ({
	name: "TodoVM",
	states: { todos: [] as readonly string[], filter: "" },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ITodoState>) => void;
		get: () => ITodoState;
	}) => ({
		add: (todo: string) => set({ todos: [...get().todos, todo] }),
	}),
});

describe("createLankaVM (Angular)", () => {
	it("is declared at module level with no injection context anywhere in sight", () => {
		// The defect this shape exists to avoid: `toLankaSignals` pre-applied here
		// would assert an injection context at IMPORT time and throw before a
		// component ever existed. What is pre-applied is `useLankaVM`, which
		// asserts per call.
		expect(() => createLankaVM<ITodoState, ITodoActions>(config())).not.toThrow();
	});

	it("answers a ViewModel that is already callable, inside an injection context", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const state = runInInjectionContext(scope(), () => todoVM());

		expect(state().todos).toEqual([]);

		todoVM.getState().add("write");

		expect(state().todos).toEqual(["write"]);
	});

	it("takes a selector, the second call shape the shelf shares", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const count = runInInjectionContext(scope(), () => todoVM((state) => state.todos.length));

		expect(count()).toBe(0);

		todoVM.getState().add("write");

		expect(count()).toBe(1);
	});

	it("is the ViewModel too: its members answer outside a component", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());

		expect(todoVM.name).toBe("TodoVM");
		expect(todoVM.getState().todos).toEqual([]);
		expect(typeof todoVM.subscribe).toBe("function");
		expect("getState" in todoVM).toBe(true);
	});

	it("is one store, and the same store core's own factory builds", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const seen: number[] = [];

		todoVM.subscribe((next) => seen.push(next.todos.length));
		todoVM.getState().add("write");

		expect(seen).toEqual([1]);
		expect(todoVM.getState().todos).toEqual(["write"]);

		// The framework-free declaration, for comparison: same config, same answer.
		const coreTodoVM = createCoreLankaVM<ITodoState, ITodoActions>(config());

		coreTodoVM.getState().add("write");
		expect(coreTodoVM.getState().todos).toEqual(todoVM.getState().todos);
	});
});
