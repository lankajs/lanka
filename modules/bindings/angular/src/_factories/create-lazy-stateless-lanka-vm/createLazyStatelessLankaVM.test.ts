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
import { createLazyStatelessLankaVM } from "./createLazyStatelessLankaVM";

/**
 * The stateless factory's lazy half, declared in one line — and still lazy.
 *
 * Its parameter type is derived from core's factory rather than named, because
 * core declares two types under one name and publishes only one of them. The
 * test that this matters is the LAST one here: a config core accepts must not be
 * refused by the mirror.
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

interface IImportActions {
	run: () => void;
}

describe("createLazyStatelessLankaVM (Angular)", () => {
	it("builds nothing at the declaration, needs no injection context, and builds once on first use", () => {
		const built: string[] = [];
		const declare = () =>
			createLazyStatelessLankaVM<IImportActions>({
				name: "LazyImportVM",
				createActions: () => {
					built.push("createActions");

					return { run: () => undefined };
				},
			});

		expect(declare).not.toThrow();

		const importVM = declare();

		expect(built).toEqual([]);
		expect(importVM.name).toBe("LazyImportVM");
		expect(built).toEqual([]);

		importVM.getState().run();
		expect(built).toEqual(["createActions"]);

		importVM.getState().run();
		expect(built).toEqual(["createActions"]);
	});

	it("reads from inside an injection context, and the read is what builds it", () => {
		const built: string[] = [];
		const ran: string[] = [];
		const importVM = createLazyStatelessLankaVM<IImportActions>({
			name: "LazyImportVM",
			createActions: () => {
				built.push("createActions");

				return { run: () => ran.push("run") };
			},
		});

		const state = runInInjectionContext(scope(), () => importVM());

		expect(built).toEqual(["createActions"]);

		state().run();
		expect(ran).toEqual(["run"]);
	});

	it("keeps `dispose`, which is the member the lazy shape adds", () => {
		const importVM = createLazyStatelessLankaVM<IImportActions>({
			name: "LazyImportVM",
			createActions: () => ({ run: () => undefined }),
		});

		expect(typeof importVM.dispose).toBe("function");
	});

	it("takes the context core's own factory hands a stateless config", () => {
		let sawSet = false;

		const importVM = createLazyStatelessLankaVM<IImportActions>({
			name: "LazyImportVM",
			createActions: ({ set }) => {
				// The point of the derived parameter type: whatever shape of context
				// core passes, this config must type-check here exactly as it does
				// against `lanka/viewmodel`. A named type that was not core's would
				// have failed to compile rather than failed a run.
				sawSet = typeof set === "function";

				return { run: () => undefined };
			},
		});

		importVM.getState().run();
		expect(sawSet).toBe(true);
	});
});
