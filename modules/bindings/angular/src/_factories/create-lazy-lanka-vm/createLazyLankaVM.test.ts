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
import { createLazyLankaVM } from "./createLazyLankaVM";

/**
 * The lazy declaration, in one line — and still lazy.
 *
 * The whole reason this factory exists is that a ViewModel a session may never
 * open costs nothing until it is opened. Wrapping it at the declaration site is
 * the obvious place to lose that: a wrapper that copied members instead of
 * forwarding would build the store to read them.
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

interface ICounterState {
	value: number;
}

interface ICounterActions {
	bump: () => void;
}

const spyingConfig = () => {
	const built: string[] = [];

	return {
		built,
		config: {
			name: "LazyCounterVM",
			states: { value: 0 },
			createActions: ({
				set,
				get,
			}: {
				set: (partial: Partial<ICounterState>) => void;
				get: () => ICounterState;
			}) => {
				built.push("createActions");

				return { bump: () => set({ value: get().value + 1 }) };
			},
		},
	};
};

describe("createLazyLankaVM (Angular)", () => {
	it("builds nothing at the declaration, and needs no injection context to be declared", () => {
		const { built, config } = spyingConfig();

		expect(() => createLazyLankaVM<ICounterState, ICounterActions>(config)).not.toThrow();
		expect(built).toEqual([]);
	});

	it("builds nothing to answer its name", () => {
		const { built, config } = spyingConfig();
		const counterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		// Answered from the config by the lazy proxy, and forwarded by the Proxy
		// this factory wraps it in. Either one copying members would build here.
		expect(counterVM.name).toBe("LazyCounterVM");
		expect(built).toEqual([]);
	});

	it("builds on the first read, once, and reads as a signal afterwards", () => {
		const { built, config } = spyingConfig();
		const counterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		counterVM.getState().bump();
		expect(built).toEqual(["createActions"]);
		expect(counterVM.getState().value).toBe(1);

		const state = runInInjectionContext(scope(), () => counterVM());

		expect(state().value).toBe(1);
		expect(built).toEqual(["createActions"]);
	});

	it("keeps `dispose`, which is the member the lazy shape adds", () => {
		const { config } = spyingConfig();
		const counterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		expect(typeof counterVM.dispose).toBe("function");
	});
});
