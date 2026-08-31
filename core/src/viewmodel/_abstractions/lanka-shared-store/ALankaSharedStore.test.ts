import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALankaSharedStore } from "./ALankaSharedStore";

interface ITestSharedStoreState {
	count: number;
}

class TestSharedStore extends ALankaSharedStore<ITestSharedStoreState> {
	constructor() {
		super(() => ({ count: 0 }));
	}

	public increment(): void {
		this.setState((state) => ({
			count: state.count + 1,
		}));
	}
}

describe("ALankaSharedStore", () => {
	let store: TestSharedStore;

	beforeEach(() => {
		store = new TestSharedStore();
	});

	it("provides getState and setState", () => {
		expect(store.getState().count).toBe(0);

		store.setState({ count: 5 });

		expect(store.getState().count).toBe(5);
	});

	it("notifies subscribers on state changes", () => {
		const listener = vi.fn();
		const unsubscribe = store.subscribe((state) => {
			listener(state.count);
		});

		store.increment();

		expect(listener).toHaveBeenCalledWith(1);
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();
		store.increment();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("resets to what it was built with, from either style", () => {
		store.setState({ count: 7 });
		expect(store.getState().count).toBe(7);

		store.reset();

		expect(store.getState().count).toBe(0);
	});
});
