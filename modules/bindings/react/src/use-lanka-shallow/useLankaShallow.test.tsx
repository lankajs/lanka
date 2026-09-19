import { createLankaVM } from "lanka/viewmodel";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLankaShallow } from "./useLankaShallow";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";
import type { JSX } from "react";

/**
 * The commonest thing a React reader writes, and what it costs unwrapped.
 *
 * This file was written when an unwrapped object selector CRASHED —
 * `useSyncExternalStore` read the snapshot twice per commit, a fresh object
 * disagreed with itself, and the component rendered until React stopped it. That
 * hole is closed in `useLankaVM`, which now runs a selector once per state
 * object: the conformance suite's fresh-object scene is what holds it shut, for
 * all five bindings rather than for this one.
 *
 * What is left is the reason the wrapper exists on its own terms, and it is the
 * whole of what a selector is FOR. Held only against the state it came from, a
 * fresh-object selection is new whenever the state is new, so the reader wakes
 * for every change in the ViewModel — including the keys it took a selector to
 * say it did not care about. The first scene drives the unwrapped selector and
 * measures exactly that, so nothing here can pass whether or not
 * `useLankaShallow` does anything.
 */
afterEach(cleanup);

interface IMissionState {
	title: string;
	status: string;
	unrelated: number;
}

interface IMissionActions {
	rename: (title: string) => void;
	touch: () => void;
}

const build = () =>
	createLankaVM<IMissionState, IMissionActions>({
		name: "MissionVM",
		states: { title: "survey", status: "queued", unrelated: 0 },
		createActions: ({ set, get }) => ({
			rename: (title) => set({ title }),
			touch: () => set({ unrelated: get().unrelated + 1 }),
		}),
	});

describe("the waste it exists for", () => {
	it("PROVES the cost: an unwrapped object selector wakes for a key it never picked", () => {
		// A gate that cannot fail reports success, and the same is true of a fix:
		// this is the scene that would pass whether or not `useLankaShallow` did
		// anything, so it drives the version WITHOUT it. Its twin two blocks down
		// is the same component wrapped, and asserts the opposite.
		const missionVM = build();
		const renders = vi.fn();
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(missionVM, (state) => ({
				title: state.title,
				status: state.status,
			}));
			renders();

			return <p>{title}</p>;
		};
		render(<Screen />);
		const before = renders.mock.calls.length;

		act(() => missionVM.getState().touch());

		expect(renders.mock.calls.length).toBeGreaterThan(before);
	});

	it("renders at all, where this once threw on the first paint", () => {
		// The defect the wrapper was introduced for, kept as a scene now that the
		// binding closes it: a fresh-object selector paints. It is asserted here as
		// well as in the conformance suite because THIS is the call a consumer
		// copies out of the file, and a fix nobody can see in the place the bug was
		// reported is a fix the next reader re-introduces.
		const missionVM = build();
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(missionVM, (state) => ({
				title: state.title,
				status: state.status,
			}));

			return <p data-testid="raw">{title}</p>;
		};

		render(<Screen />);

		expect(screen.getByTestId("raw").textContent).toBe("survey");
	});

	it("does not loop once the selection is held", () => {
		const missionVM = build();
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(
				missionVM,
				useLankaShallow((state: IMissionState) => ({
					title: state.title,
					status: state.status,
				})),
			);

			return <p data-testid="title">{title}</p>;
		};

		render(<Screen />);

		expect(screen.getByTestId("title").textContent).toBe("survey");
	});
});

describe("what it holds and what it lets through", () => {
	it("re-renders when a selected key moves", () => {
		const missionVM = build();
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(
				missionVM,
				useLankaShallow((state: IMissionState) => ({
					title: state.title,
					status: state.status,
				})),
			);

			return <p data-testid="title">{title}</p>;
		};
		render(<Screen />);

		act(() => missionVM.getState().rename("map the delta"));

		expect(screen.getByTestId("title").textContent).toBe("map the delta");
	});

	it("does NOT re-render when an unselected key moves", () => {
		// A selector is the reader saying what it cares about, and holding the
		// answer is what makes that statement mean anything: without it every
		// change to any key repainted, because every read built a new object.
		const missionVM = build();
		const renders = vi.fn();
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(
				missionVM,
				useLankaShallow((state: IMissionState) => ({ title: state.title })),
			);
			renders();

			return <p>{title}</p>;
		};
		render(<Screen />);
		const before = renders.mock.calls.length;

		act(() => missionVM.getState().touch());

		expect(renders.mock.calls.length).toBe(before);
	});

	it("re-renders when a selected key moves back and forth", () => {
		const missionVM = build();
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(
				missionVM,
				useLankaShallow((state: IMissionState) => ({ title: state.title })),
			);

			return (
				<button type="button" onClick={() => missionVM.getState().rename("survey")}>
					{title}
				</button>
			);
		};
		render(<Screen />);
		act(() => missionVM.getState().rename("map the delta"));

		fireEvent.click(screen.getByText("map the delta"));

		expect(screen.getByText("survey")).toBeDefined();
	});
});

describe("the comparison itself", () => {
	const shallowOf = <TSelected,>(selector: (state: IMissionState) => TSelected) => {
		let read: (state: IMissionState) => TSelected = () => {
			throw new Error("not rendered");
		};
		const Probe = (): null => {
			read = useLankaShallow(selector);

			return null;
		};
		render(<Probe />);

		return (state: IMissionState) => read(state);
	};

	const state = (over: Partial<IMissionState> = {}): IMissionState => ({
		title: "survey",
		status: "queued",
		unrelated: 0,
		...over,
	});

	it("hands back the SAME object when every key matched", () => {
		const pick = shallowOf((s) => ({ title: s.title }));

		const first = pick(state());
		const second = pick(state({ unrelated: 9 }));

		expect(second).toBe(first);
	});

	it("hands back a new object when a key moved", () => {
		const pick = shallowOf((s) => ({ title: s.title }));

		const first = pick(state());
		const second = pick(state({ title: "map the delta" }));

		expect(second).not.toBe(first);
		expect(second).toEqual({ title: "map the delta" });
	});

	it("compares arrays too, because a selection is usually one", () => {
		const pick = shallowOf((s) => [s.title, s.status]);

		const first = pick(state());

		expect(pick(state({ unrelated: 1 }))).toBe(first);
		expect(pick(state({ status: "active" }))).not.toBe(first);
	});

	it("is ONE level deep, and says so by failing on a nested change", () => {
		// Deeper would mean walking a state of unknown size on every read, which is
		// the cost a reader took a selector to avoid. A selection with a nested
		// object wants a selector that picks the leaves.
		const pick = shallowOf((s) => ({ nested: { title: s.title } }));

		const first = pick(state());

		expect(pick(state())).not.toBe(first);
	});

	it("notices a key appearing or disappearing", () => {
		const pick = shallowOf((s) =>
			s.unrelated > 0 ? { title: s.title, status: s.status } : { title: s.title },
		);

		const first = pick(state());

		expect(pick(state({ unrelated: 1 }))).not.toBe(first);
	});

	it("passes a primitive selection straight through", () => {
		// The shape that never had the problem. It must not become slower or
		// stranger for having a wrapper available.
		const pick = shallowOf((s) => s.title);

		expect(pick(state())).toBe("survey");
		expect(pick(state({ title: "map the delta" }))).toBe("map the delta");
	});
});
