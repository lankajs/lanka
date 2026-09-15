import { createLankaVM } from "lanka/viewmodel";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLankaShallow } from "./useLankaShallow";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";
import type { JSX } from "react";

/**
 * The commonest thing a React reader writes, and what it used to do.
 *
 * Every scene here has a twin that would have crashed: `useSyncExternalStore`
 * reads the snapshot during render, and a selector building a fresh object told
 * it the store had changed on every read. The first scene proves the crash is
 * real rather than remembered — it drives the unwrapped selector and asserts the
 * failure by name.
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

describe("the trap it exists for", () => {
	it("PROVES the crash: a raw object selector loops on the first paint", () => {
		const missionVM = build();
		const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(missionVM, (state) => ({
				title: state.title,
				status: state.status,
			}));

			return <p>{title}</p>;
		};

		// A gate that cannot fail reports success, and the same is true of a fix:
		// this is the scene that would pass whether or not `useLankaShallow` did
		// anything, so it drives the version WITHOUT it.
		expect(() => render(<Screen />)).toThrow(/Maximum update depth/i);

		quiet.mockRestore();
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
