import { describe, expect, it } from "vitest";
import { createLazyStatelessLankaVM } from "./createLazyStatelessLankaVM";

/**
 * The stateless factory's lazy half, declared in one line — and still lazy.
 *
 * Its parameter type is derived from core's factory rather than named, because
 * core declares two types under one name and publishes only one of them. The
 * test that this matters is the LAST one here: a config core accepts must not be
 * refused by the mirror.
 */
interface IImportActions {
	run: () => void;
}

describe("createLazyStatelessLankaVM (Vue)", () => {
	it("builds nothing at the declaration, and builds once on first use", () => {
		const built: string[] = [];
		const useImportVM = createLazyStatelessLankaVM<IImportActions>({
			name: "LazyImportVM",
			createActions: () => {
				built.push("createActions");

				return { run: () => undefined };
			},
		});

		expect(built).toEqual([]);
		expect(useImportVM.name).toBe("LazyImportVM");
		expect(built).toEqual([]);

		useImportVM.getState().run();
		expect(built).toEqual(["createActions"]);

		useImportVM.getState().run();
		expect(built).toEqual(["createActions"]);
	});

	it("keeps `dispose`, which is the member the lazy shape adds", () => {
		const useImportVM = createLazyStatelessLankaVM<IImportActions>({
			name: "LazyImportVM",
			createActions: () => ({ run: () => undefined }),
		});

		expect(typeof useImportVM.dispose).toBe("function");
	});

	it("takes the context core's own factory hands a stateless config", () => {
		let sawSet = false;

		const useImportVM = createLazyStatelessLankaVM<IImportActions>({
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

		useImportVM.getState().run();
		expect(sawSet).toBe(true);
	});
});
