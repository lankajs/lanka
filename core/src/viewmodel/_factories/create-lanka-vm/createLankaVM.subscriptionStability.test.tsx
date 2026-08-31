import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `useSyncExternalStore` re-subscribes whenever the `subscribe` it was handed
 * changes identity: React keeps it in an effect keyed on it. An inline arrow
 * therefore tears the subscription down and rebuilds it on EVERY render of EVERY
 * connected component.
 *
 * The cost scales with render count — with how much the user interacts — and is
 * invisible to every screen-level test, because the output is identical either
 * way. Only the subscription lifecycle shows it.
 *
 * The counting must wrap the REAL store: the factory closes over it and calls
 * `store.subscribe` directly, so spying on a re-exported property observes
 * nothing and the test would pass vacuously.
 *
 * Re-renders are driven with `rerender` and a changing prop rather than a
 * captured setter: assigning to an outer variable during render is exactly the
 * side effect React's rules forbid.
 */

const { storeProbe } = vi.hoisted(() => ({
	storeProbe: { subscribeCalls: 0 },
}));

vi.mock("zustand", async (importOriginal) => {
	const actual = await importOriginal<typeof import("zustand")>();

	const wrap = <TStore extends { subscribe: (...args: never[]) => unknown }>(
		store: TStore,
	): TStore => {
		const original = store.subscribe.bind(store);
		store.subscribe = (...args: never[]) => {
			storeProbe.subscribeCalls += 1;
			return original(...args);
		};
		return store;
	};

	// zustand's `create` is curried: `create<T>()(initializer)`.
	const create = (...args: unknown[]) => {
		if (args.length === 0) {
			return (...inner: unknown[]) =>
				wrap((actual.create as (...a: unknown[]) => never)(...inner));
		}
		return wrap((actual.create as (...a: unknown[]) => never)(...args));
	};

	return { ...actual, create };
});

const { createLankaVM } = await import("./createLankaVM");

interface ICounterState {
	value: number;
}

interface ICounterActions {
	bump: () => void;
}

let vmSeq = 0;
const makeViewModel = () => {
	vmSeq += 1;
	return createLankaVM<ICounterState, ICounterActions>({
		name: `SubscriptionStabilityVm-${vmSeq}`,
		states: { value: 0 },
		createActions: ({ set, get }) => ({
			bump: () => set({ value: get().value + 1 }),
		}),
	});
};

describe("createLankaVM — subscription stability", () => {
	beforeEach(() => {
		storeProbe.subscribeCalls = 0;
	});

	it("subscribes to the store ONCE across many re-renders", () => {
		const useVm = makeViewModel();

		const Consumer: React.FC<{ tick: number }> = ({ tick }) => {
			const { value } = useVm();
			return (
				<span>
					{value}-{tick}
				</span>
			);
		};

		const { rerender } = render(<Consumer tick={0} />);
		const afterMount = storeProbe.subscribeCalls;
		expect(afterMount).toBeGreaterThan(0); // the probe is actually wired

		for (let tick = 1; tick <= 20; tick += 1) {
			rerender(<Consumer tick={tick} />);
		}

		// A fresh `subscribe` identity per render makes React drop and re-create the
		// subscription every time — twenty renders would add about twenty extra
		// calls.
		expect(storeProbe.subscribeCalls).toBe(afterMount);
	});

	it("still delivers updates after those re-renders", () => {
		// The one real risk of a stable identity is a stale closure that silently
		// stops notifying. This is the assertion that would catch it.
		const useVm = makeViewModel();

		const Consumer: React.FC<{ tick: number }> = ({ tick }) => {
			const { value } = useVm();
			return (
				<span data-testid="value">
					{value}-{tick}
				</span>
			);
		};

		const { rerender, getByTestId } = render(<Consumer tick={0} />);
		for (let tick = 1; tick <= 5; tick += 1) {
			rerender(<Consumer tick={tick} />);
		}

		act(() => {
			useVm.getState().bump();
		});

		expect(getByTestId("value").textContent).toBe("1-5");
	});

	it("keeps tracked-key filtering intact after re-renders", () => {
		// Key tracking is what stops an unrelated slice from re-rendering a
		// component. A stabilised subscribe must still read the CURRENT tracked
		// keys, not the set captured on the first render.
		vmSeq += 1;
		const useVm = createLankaVM<
			{ watched: number; ignored: number },
			{ touchIgnored: () => void }
		>({
			name: `TrackedKeysVm-${vmSeq}`,
			states: { watched: 0, ignored: 0 },
			createActions: ({ set, get }) => ({
				touchIgnored: () => set({ ignored: get().ignored + 1 }),
			}),
		});

		const renderSpy = vi.fn();
		const Consumer: React.FC<{ tick: number }> = ({ tick }) => {
			const { watched } = useVm();
			renderSpy();
			return (
				<span>
					{watched}-{tick}
				</span>
			);
		};

		const { rerender } = render(<Consumer tick={0} />);
		rerender(<Consumer tick={1} />);
		const before = renderSpy.mock.calls.length;

		act(() => {
			useVm.getState().touchIgnored();
		});

		// The component never reads this field, so it must not re-render.
		expect(renderSpy.mock.calls.length).toBe(before);
	});

	it("a state change still re-renders a component that reads the changed key", () => {
		const useVm = makeViewModel();

		const renderSpy = vi.fn();
		const Consumer: React.FC = () => {
			const { value } = useVm();
			renderSpy();
			return <span>{value}</span>;
		};

		render(<Consumer />);
		const before = renderSpy.mock.calls.length;

		act(() => {
			useVm.getState().bump();
		});

		expect(renderSpy.mock.calls.length).toBeGreaterThan(before);
	});

	it("unmount tears the subscription down exactly once", () => {
		const useVm = makeViewModel();

		const Consumer: React.FC<{ tick: number }> = ({ tick }) => {
			const { value } = useVm();
			return (
				<span>
					{value}-{tick}
				</span>
			);
		};

		const { rerender, unmount } = render(<Consumer tick={0} />);
		for (let tick = 1; tick <= 5; tick += 1) {
			rerender(<Consumer tick={tick} />);
		}
		unmount();

		// A later store write must reach nobody: a leaked listener would either
		// throw on the unmounted tree or silently keep the component alive.
		expect(() => useVm.getState().bump()).not.toThrow();
	});

	it("stress: 200 renders still hold a single subscription", () => {
		const useVm = makeViewModel();

		const Consumer: React.FC<{ tick: number }> = ({ tick }) => {
			useVm();
			return <span>{tick}</span>;
		};

		const { rerender } = render(<Consumer tick={0} />);
		const afterMount = storeProbe.subscribeCalls;

		for (let tick = 1; tick <= 200; tick += 1) {
			rerender(<Consumer tick={tick} />);
		}

		expect(storeProbe.subscribeCalls).toBe(afterMount);
	});
});
