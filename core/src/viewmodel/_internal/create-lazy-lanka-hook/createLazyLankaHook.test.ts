import { describe, expect, it, vi } from "vitest";
import { createLazyLankaHook } from "./createLazyLankaHook";

interface IProbeState {
	resetScenario: () => void;
	rows: readonly string[];
}

/**
 * A store-shaped object with a member no zustand version has.
 *
 * Shaped by hand rather than built by a real factory: the subject here is the
 * lazy mechanism, and a real ViewModel would bring a bus, a registry and a
 * scenario binder to a test about when a function is called.
 */
interface IProbeStore {
	(selector?: (state: IProbeState) => unknown): unknown;
	getState: () => IProbeState;
	somethingAddedTomorrow: (suffix: string) => string;
}

const fakeStore = (): IProbeStore => {
	const state: IProbeState = { resetScenario: vi.fn(), rows: ["a"] };

	const store = ((selector?: (current: IProbeState) => unknown) =>
		selector ? selector(state) : state) as IProbeStore;

	store.getState = () => state;
	store.somethingAddedTomorrow = (suffix: string) => `today${suffix}`;

	return store;
};

const lazy = (create: () => IProbeStore) =>
	createLazyLankaHook<IProbeStore>({ name: "LazyProbe", kind: "VM", create });

describe("a lazily built hook", () => {
	it("builds nothing until something asks", () => {
		const create = vi.fn(fakeStore);

		lazy(create);

		expect(create).not.toHaveBeenCalled();
	});

	it("builds once, however many times it is used", () => {
		const create = vi.fn(fakeStore);
		const hook = lazy(create);

		hook();
		hook();
		hook.getState();

		expect(create).toHaveBeenCalledOnce();
	});

	// The reason this is a Proxy and not a list of members: what the store has,
	// the lazy hook has — including a member added after this file was written.
	it("forwards a member this file has never heard of", () => {
		const hook = lazy(fakeStore);

		expect(hook.somethingAddedTomorrow("!")).toBe("today!");
	});

	it("passes a selector through, and answers without one", () => {
		const hook = lazy(fakeStore);

		expect(hook((state) => state.rows)).toEqual(["a"]);
		expect(hook.getState().rows).toEqual(["a"]);
	});

	// Reading a member must stay free, or "lazy" ends at the first devtool, spread
	// or debugger that looks at the object — which is most of how objects are read.
	it("builds on the CALL, not on the look", () => {
		const create = vi.fn(fakeStore);
		const hook = lazy(create);

		const read = hook.getState;
		expect(create).not.toHaveBeenCalled();

		read();

		expect(create).toHaveBeenCalledOnce();
	});
});

describe("releasing a lazily built hook", () => {
	it("unsubscribes the scenarios before dropping the store", () => {
		const store = fakeStore();
		const hook = lazy(() => store);
		hook();

		hook.dispose();

		expect(store.getState().resetScenario).toHaveBeenCalledOnce();
	});

	it("builds again on the next access", () => {
		const create = vi.fn(fakeStore);
		const hook = lazy(create);
		hook();

		hook.dispose();
		hook();

		expect(create).toHaveBeenCalledTimes(2);
	});

	// Building a store in order to destroy it is work with no result, and it would
	// resurrect a ViewModel that a closed screen had just released.
	it("builds NOTHING when there was nothing to release", () => {
		const create = vi.fn(fakeStore);
		const hook = lazy(create);

		hook.dispose();

		expect(create).not.toHaveBeenCalled();
	});
});
