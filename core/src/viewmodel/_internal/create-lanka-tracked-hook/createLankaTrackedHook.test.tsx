import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { createLankaTrackedHook } from "./createLankaTrackedHook";

/**
 * The hook both ViewModel families render through.
 *
 * Tested here on a plain source rather than through a factory: the properties
 * below are the hook's own, and reaching them through a ViewModel is what let
 * the two copies of this code drift apart in the first place.
 */
interface IState extends Record<string, unknown> {
	a: number;
	b: number;
}

/** A minimal store with the shape the hook subscribes to. */
const createSource = (initial: IState) => {
	let state = initial;
	const listeners = new Set<(next: IState, prev: IState) => void>();

	return {
		readState: () => state,
		subscribe: (onChange: (next: IState, prev: IState) => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		set(patch: Partial<IState>) {
			const prev = state;
			state = { ...state, ...patch };
			for (const listener of listeners) listener(state, prev);
		},
		get listenerCount() {
			return listeners.size;
		},
	};
};

afterEach(cleanup);

describe("createLankaTrackedHook", () => {
	it("re-renders when a key the component READ changes", () => {
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);
		const renders = vi.fn();

		function Screen() {
			const state = useTracked() as IState;
			renders();
			return <span>{state.a}</span>;
		}

		render(<Screen />);
		act(() => {
			source.set({ a: 2 });
		});

		expect(renders).toHaveBeenCalledTimes(2);
	});

	it("does NOT re-render when only an unread key changes", () => {
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);
		const renders = vi.fn();

		function Screen() {
			const state = useTracked() as IState;
			renders();
			return <span>{state.a}</span>;
		}

		render(<Screen />);
		act(() => {
			source.set({ b: 2 });
		});

		expect(renders).toHaveBeenCalledTimes(1);
	});

	it("re-renders on any change while the component has read nothing", () => {
		// Nothing read means nothing to compare against, and skipping the render
		// would freeze a component that starts reading later.
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);
		const renders = vi.fn();

		function Screen() {
			useTracked();
			renders();
			return <span>constant</span>;
		}

		render(<Screen />);
		act(() => {
			source.set({ b: 2 });
		});

		expect(renders).toHaveBeenCalledTimes(2);
	});

	it("lets a selector decide, bypassing tracking entirely", () => {
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);
		const renders = vi.fn();

		function Screen() {
			const a = useTracked((state) => state.a) as number;
			renders();
			return <span>{a}</span>;
		}

		render(<Screen />);
		act(() => {
			source.set({ b: 2 });
		});

		// A selector means the caller took responsibility: React compares what the
		// selector returned, and `a` did not move.
		expect(renders).toHaveBeenCalledTimes(1);
	});

	it("subscribes ONCE across many re-renders", () => {
		// `useSyncExternalStore` keys its subscription effect on the identity of
		// `subscribe`. An inline arrow would tear the subscription down and rebuild
		// it on every render of every connected component.
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);

		function Screen() {
			const state = useTracked() as IState;
			return <span>{state.a}</span>;
		}

		render(<Screen />);
		for (let i = 0; i < 20; i += 1) {
			act(() => {
				source.set({ a: i + 2 });
			});
		}

		expect(source.listenerCount).toBe(1);
	});

	it("reports a change that touched no tracked key", () => {
		const source = createSource({ a: 1, b: 1 });
		const onUntrackedChange = vi.fn();
		const useTracked = createLankaTrackedHook<IState>({ ...source, onUntrackedChange });

		function Screen() {
			const state = useTracked() as IState;
			return <span>{state.a}</span>;
		}

		render(<Screen />);
		act(() => {
			source.set({ b: 2 });
		});

		expect(onUntrackedChange).toHaveBeenCalledOnce();
		const [trackedKeys, next, prev] = onUntrackedChange.mock.calls[0] as [
			Set<string>,
			IState,
			IState,
		];
		expect(trackedKeys.has("a")).toBe(true);
		expect(next.b).toBe(2);
		expect(prev.b).toBe(1);
	});

	it("works without an untracked-change reporter", () => {
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);

		function Screen() {
			const state = useTracked() as IState;
			return <span>{state.a}</span>;
		}

		render(<Screen />);

		expect(() => {
			act(() => {
				source.set({ b: 2 });
			});
		}).not.toThrow();
	});

	it("releases its subscription when the component goes away", () => {
		const source = createSource({ a: 1, b: 1 });
		const useTracked = createLankaTrackedHook<IState>(source);

		function Screen() {
			const state = useTracked() as IState;
			return <span>{state.a}</span>;
		}

		const view = render(<Screen />);
		expect(source.listenerCount).toBe(1);

		view.unmount();
		expect(source.listenerCount).toBe(0);
	});
});
