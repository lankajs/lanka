import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineLankaVM } from "./defineLankaVM";
import { resolveLankaVM } from "../resolve-lanka-vm/resolveLankaVM";
import { ALankaVM } from "../../_abstractions/lanka-vm/ALankaVM";
import { createLankaVM } from "../create-lanka-vm/createLankaVM";
import {
	setLankaRuntimeResolver,
	setLankaScopeResolver,
} from "../../../_internal/active-runtime/activeRuntime";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import type { ILankaVMDefinition } from "./defineLankaVM";

/**
 * A ViewModel whose lifetime is the current scope, and the two holes the surface
 * review found before any of it shipped.
 *
 * Both are asserted here rather than described: a scoped ViewModel that leaked
 * its declaration into the process, and a resolve outside every scope that was
 * handed the last request's instance. Each made the feature do exactly what it
 * exists to prevent, and neither would have failed a single other test.
 */
const host = {
	apiBaseUrl: "https://api.example.com",
	httpErrorMessage: (status: number) => `status ${String(status)}`,
	networkErrorMessage: () => "network",
	timeoutErrorMessage: () => "timeout",
};

const startInstance = () => createLanka({ host });

afterEach(() => {
	setLankaScopeResolver(null);
	setLankaRuntimeResolver(null);
});

interface ICounterState {
	count: number;
}

interface ICounterActions {
	bump: () => void;
}

const counter = (): ILankaVMDefinition<
	ReturnType<typeof createLankaVM<ICounterState, ICounterActions>>
> =>
	defineLankaVM({
		name: "CounterVM",
		build: () =>
			createLankaVM<ICounterState, ICounterActions>({
				name: "CounterVM",
				states: { count: 0 },
				createActions: ({ set, get }) => ({
					bump: () => {
						set({ count: get().count + 1 });
					},
				}),
			}),
	});

describe("a definition, which is a key rather than a thing", () => {
	beforeEach(() => {
		startInstance().activate();
	});

	it("answers the SAME instance twice in one scope", () => {
		const definition = counter();

		expect(resolveLankaVM(definition)).toBe(resolveLankaVM(definition));
	});

	it("builds nothing until something resolves it", () => {
		const build = vi.fn(() =>
			createLankaVM<ICounterState, ICounterActions>({
				name: "CounterVM",
				states: { count: 0 },
				createActions: () => ({ bump: () => undefined }),
			}),
		);

		defineLankaVM({ name: "CounterVM", build });

		// The whole difference from a module-level `const`: declaring costs nothing,
		// and a definition nobody resolves is a store that never existed.
		expect(build).not.toHaveBeenCalled();
	});

	it("refuses anything `defineLankaVM` did not make", () => {
		// The type is opaque, so this cannot be written in TypeScript — which is the
		// point of the brand. The scene is here for the JavaScript caller and for
		// the day somebody casts.
		expect(() => resolveLankaVM({} as ILankaVMDefinition<never>)).toThrow(/opaque/i);
	});

	it("gives two definitions two instances, however alike they are", () => {
		expect(resolveLankaVM(counter())).not.toBe(resolveLankaVM(counter()));
	});
});

describe("two scopes, and what neither may see", () => {
	it("answers a different instance in each", () => {
		// The claim the whole feature exists for. Two server renders overlapping is
		// the normal case, not the exotic one.
		const definition = counter();
		const first = { id: "request-1" };
		const second = { id: "request-2" };
		let current: object | null = first;

		startInstance().activate();
		setLankaScopeResolver(() => current);

		const one = resolveLankaVM(definition);
		one.getState().bump();

		current = second;
		const two = resolveLankaVM(definition);

		expect(two).not.toBe(one);
		expect(two.getState().count).toBe(0);
		expect(one.getState().count).toBe(1);
	});

	it("THROWS outside every scope, rather than handing over the last one's", () => {
		// The hole the review found. `runInLankaServerScope` creates its instance
		// INSIDE the scope and `createLanka` activates everything it builds, so
		// during a request the process pointer and the scope's runtime are the same
		// object. Keyed on the runtime, a call made after the request ended would
		// resolve against it and be handed the last stranger's ViewModel — the
		// original "one per PROCESS" failure, now holding user state on purpose.
		const definition = counter();

		startInstance().activate();
		setLankaScopeResolver(() => null);

		expect(() => resolveLankaVM(definition)).toThrow(/outside every scope/i);
	});

	it("names the definition in that refusal, because a stack trace will not", () => {
		startInstance().activate();
		setLankaScopeResolver(() => null);

		expect(() => resolveLankaVM(counter())).toThrow(/CounterVM/);
	});

	it("keys on the INSTANCE where nothing knows about scopes", () => {
		// A browser installs no scope resolver, and that is the right answer there:
		// a tab is one scope for its whole life, so this is the module-level
		// ViewModel a consumer already knows.
		const definition = counter();

		startInstance().activate();

		expect(resolveLankaVM(definition)).toBe(resolveLankaVM(definition));
	});
});

describe("what a scoped ViewModel must NOT leave behind", () => {
	class ScopedVM extends ALankaVM<ICounterState, ICounterActions> {
		protected readonly name = "ScopedVM";

		protected states(): ICounterState {
			return { count: 0 };
		}

		protected createActions(): ICounterActions {
			return { bump: () => undefined };
		}

		/*
		 * A FACTORY, and the empty object it replaced is why this comment exists.
		 *
		 * `ALankaVM.build()` only registers a ViewModel that needs bootstrap, and
		 * `{}` does not: the condition asks for a function, a non-empty array or a
		 * lifecycle hook. With `{}` both scenes below passed while registering
		 * nothing — one of them vacuously, which is the way a test lies.
		 */
		protected scenarioHandlers() {
			return (() => []) as unknown as ReturnType<
				ALankaVM<ICounterState, ICounterActions>["scenarioHandlers"]
			>;
		}
	}

	it("does not declare itself into the PROCESS, so a later instance cannot adopt it", () => {
		// The blocker the review found, and nothing else would have caught it. A
		// declaration goes into a process-lifetime array that is never drained, and
		// `createLanka` adopts the whole array on EVERY instance. One per module
		// that is correct and load-bearing; one per REQUEST and request N+1 adopts
		// request N's ViewModel, subscribes it to N+1's scenarios, and a dispatch
		// then runs N's handlers against N's gateways and writes into N's store.
		//
		// Every suite stays green while it happens. What a user sees is another
		// user's board.
		const definition = defineLankaVM({ name: "ScopedVM", build: () => new ScopedVM().build() });
		const scope = { id: "request-1" };

		startInstance().activate();
		setLankaScopeResolver(() => scope);

		const scoped = resolveLankaVM(definition);

		// A SECOND instance, which is what every later request creates. If the
		// declaration leaked, this one adopts the first scope's ViewModel.
		const second = createLanka({ host });

		second.activate();

		expect(second.viewModels.isRegistered(scoped.getState() as never)).toBe(false);
	});

	it("still declares a MODULE-level one, because that is what the array is for", () => {
		// The other arm, and the one a fix could quietly break: a ViewModel built
		// outside `resolveLankaVM` must go on being adopted by every instance, or a
		// screen file's store stops receiving the events it subscribed to.
		startInstance().activate();

		const moduleLevel = new ScopedVM().build();
		const second = createLanka({ host });

		second.activate();

		expect(second.viewModels.isRegistered(moduleLevel.getState() as never)).toBe(true);
	});
});
