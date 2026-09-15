import { describe, expect, it, vi } from "vitest";
import { createLazyLankaVMProxy } from "./createLazyLankaVMProxy";

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
	name: string;
	isAccessTracked: boolean;
	getState: () => IProbeState;
	somethingAddedTomorrow: (suffix: string) => string;
}

const fakeStore = (): IProbeStore => {
	const state: IProbeState = { resetScenario: vi.fn(), rows: ["a"] };

	const store = {} as IProbeStore;

	store.getState = () => state;
	store.somethingAddedTomorrow = (suffix: string) => `today${suffix}`;

	return store;
};

const lazy = (create: () => IProbeStore) =>
	createLazyLankaVMProxy<IProbeStore>({
		name: "LazyProbe",
		kind: "VM",
		isAccessTracked: true,
		create,
	});

describe("a lazily built ViewModel", () => {
	it("builds nothing until something asks", () => {
		const create = vi.fn(fakeStore);

		lazy(create);

		expect(create).not.toHaveBeenCalled();
	});

	it("builds once, however many times it is used", () => {
		const create = vi.fn(fakeStore);
		const hook = lazy(create);

		hook.getState();
		hook.getState();
		hook.somethingAddedTomorrow("!");

		expect(create).toHaveBeenCalledOnce();
	});

	// The reason this is a Proxy and not a list of members: what the store has,
	// the lazy hook has — including a member added after this file was written.
	it("forwards a member this file has never heard of", () => {
		const hook = lazy(fakeStore);

		expect(hook.somethingAddedTomorrow("!")).toBe("today!");
	});

	it("answers the port's two VALUE members without building", () => {
		// `name` and `isAccessTracked` are values on `ILankaReadableVM`, and a
		// binding reads both before it subscribes. Forwarded as calls they would
		// have made every lazy ViewModel eager on its first render.
		const create = vi.fn(fakeStore);
		const hook = lazy(create);

		expect(hook.name).toBe("LazyProbe");
		expect(hook.isAccessTracked).toBe(true);
		expect(create).not.toHaveBeenCalled();
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

describe("releasing a lazily built ViewModel", () => {
	it("unsubscribes the scenarios before dropping the store", () => {
		const store = fakeStore();
		const hook = lazy(() => store);
		hook.getState();

		hook.dispose();

		expect(store.getState().resetScenario).toHaveBeenCalledOnce();
	});

	it("builds again on the next access", () => {
		const create = vi.fn(fakeStore);
		const hook = lazy(create);
		hook.getState();

		hook.dispose();
		hook.getState();

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
	/**
	 * A lazy ViewModel is NOT a promise, and it must not claim to be one.
	 *
	 * `await` reads `.then` and calls it if it is a function. A trap answering
	 * every name with a wrapper made it a thenable, the wrapper forwarded to
	 * a store member that does not exist, and neither `resolve` nor `reject` was
	 * ever called — so the `await` hung forever, with no error and no stack. Any
	 * `async` function returning a lazy ViewModel deadlocked with it, because resolving
	 * a promise adopts a thenable.
	 *
	 * Real timeout, not fake timers: a hang is the absence of a settle, and only
	 * racing the clock can tell that apart from "slow".
	 */
	it("is not a thenable — awaiting it settles instead of hanging", async () => {
		const hook = lazy(fakeStore);

		const awaited = await Promise.race([
			(async () => hook)(),
			new Promise((resolve) => setTimeout(() => resolve("HUNG"), 200)),
		]);

		expect(awaited).toBe(hook);
	});

	it.each(["then", "catch", "finally"] as const)(
		"answers `%s` with undefined rather than a wrapper",
		(member) => {
			const hook = lazy(fakeStore) as unknown as Record<string, unknown>;

			expect(hook[member]).toBeUndefined();
		},
	);
});
