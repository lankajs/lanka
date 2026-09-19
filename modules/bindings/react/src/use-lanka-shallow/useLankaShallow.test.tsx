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

describe("what is React's about it", () => {
	/*
	 * The comparison itself is `createLankaShallowHold` in core, and its policy —
	 * one level deep, own keys, `Object.is`, arrays, a selection that is legitimately
	 * `undefined` — is asserted beside that unit, where four other bindings depend
	 * on the same answers and none of them imports React. Repeating it here would
	 * be a second copy to keep in step.
	 *
	 * What is React's is the part core cannot have: the hold lives in a ref so it
	 * survives a render, while the selector is re-captured every render so a
	 * selection computed from props cannot go stale. Those two pull in opposite
	 * directions, and each scene below fails if the other one wins.
	 */
	it("holds ACROSS renders, not just within one", () => {
		// The ref. A hold rebuilt per render compares every answer against nothing
		// and lets all of them through, which turns the wrapper into an expensive
		// no-op — and the screen merely repaints too often, which looks fine.
		const missionVM = build();
		const answers: { title: string }[] = [];
		const Screen = (): JSX.Element => {
			const pick = useLankaShallow((state: IMissionState) => ({ title: state.title }));
			answers.push(pick(missionVM.getState()));

			return <p data-testid="title">{answers.at(-1)!.title}</p>;
		};
		const { rerender } = render(<Screen />);

		rerender(<Screen />);
		rerender(<Screen />);

		expect(answers).toHaveLength(3);
		expect(answers[1]).toBe(answers[0]);
		expect(answers[2]).toBe(answers[0]);
	});

	it("uses THIS render's selector, so one computed from props cannot go stale", () => {
		// The other direction. Holding the selector as well as its answer would
		// freeze the first one a component ever passed, and a screen whose
		// selection depends on a prop would show the value for the prop it mounted
		// with — for ever, silently.
		const missionVM = build();
		let latest: { shown: string } | null = null;
		const Screen = ({ field }: { field: "title" | "status" }): JSX.Element => {
			const pick = useLankaShallow((state: IMissionState) => ({ shown: state[field] }));
			latest = pick(missionVM.getState());

			return <p>{latest.shown}</p>;
		};
		const { rerender } = render(<Screen field="title" />);
		expect(latest!.shown).toBe("survey");

		rerender(<Screen field="status" />);

		expect(latest!.shown).toBe("queued");
	});

	it("gives two components over one ViewModel their own hold", () => {
		// The hold belongs to the reader, like the access tracker beside it. One
		// shared between components would answer the first one's object to the
		// second, and two screens selecting different fields would see each
		// other's.
		const missionVM = build();
		const seen: Record<string, { shown: string }> = {};
		const Screen = ({ field }: { field: "title" | "status" }): JSX.Element => {
			const pick = useLankaShallow((state: IMissionState) => ({ shown: state[field] }));
			seen[field] = pick(missionVM.getState());

			return <p>{seen[field].shown}</p>;
		};

		render(
			<>
				<Screen field="title" />
				<Screen field="status" />
			</>,
		);

		expect(seen.title.shown).toBe("survey");
		expect(seen.status.shown).toBe("queued");
	});
});
