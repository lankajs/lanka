import { createLankaVM } from "lanka/viewmodel";
import { act, cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLankaVM } from "./useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";
import { StrictMode } from "react";
import type { JSX } from "react";

/**
 * What `lankaViewBindingConformance` cannot ask, because it mounts once per
 * scene: what happens across a RE-render of one already-mounted component.
 *
 * The conformance suite (run for this package in `_playground/conformance.test.tsx`)
 * already proves the first render, the tracked re-render, staleness, the blind
 * spot, unmount, two independent readers, every VM shape, the four selector
 * scenes and a server render — for every binding on the shelf. Nothing here
 * repeats it. What is left is React-specific: the two `useCallback` dependencies
 * (`viewModel`, `hasSelector`), the `useMemo` keyed on the selector's identity,
 * and the tracker built lazily into a ref rather than fresh every render.
 */
afterEach(cleanup);

interface IMissionState {
	title: string;
	count: number;
	watched: number;
	ignored: number;
}

interface IMissionActions {
	rename: (title: string) => void;
	setCount: (count: number) => void;
	bumpWatched: () => void;
	bumpIgnored: () => void;
}

const build = (name: string, title = "A"): ILankaReadableVM<IMissionState & IMissionActions> =>
	createLankaVM<IMissionState, IMissionActions>({
		name,
		states: { title, count: 0, watched: 0, ignored: 0 },
		createActions: ({ set, get }) => ({
			rename: (title) => set({ title }),
			setCount: (count) => set({ count }),
			bumpWatched: () => set({ watched: get().watched + 1 }),
			bumpIgnored: () => set({ ignored: get().ignored + 1 }),
		}),
	});

describe("switching between the tracked and selector arms at one call site", () => {
	it("resubscribes when the arm changes, and keeps reading correctly on the new one", () => {
		const missionVM = build("MissionSwap");
		const subscribe = vi.spyOn(missionVM, "subscribe");

		const Screen = ({ withSelector }: { withSelector: boolean }): JSX.Element => {
			const result = useLankaVM(missionVM, withSelector ? (state) => state.title : undefined);
			const label = typeof result === "string" ? result : result.title;
			return <p data-testid="label">{label}</p>;
		};

		const { rerender } = render(<Screen withSelector={true} />);
		expect(screen.getByTestId("label").textContent).toBe("A");
		expect(subscribe).toHaveBeenCalledTimes(1);

		rerender(<Screen withSelector={false} />);

		// `hasSelector` is the second `useCallback` dependency, and this is the
		// scene it exists for: the arm changed at the same call site, so the
		// subscription this component holds must be rebuilt rather than reused.
		expect(subscribe).toHaveBeenCalledTimes(2);

		act(() => missionVM.getState().rename("B"));
		expect(screen.getByTestId("label").textContent).toBe("B");
	});
});

describe("an inline selector, new every render", () => {
	it("does not tear down and rebuild the subscription on every render", () => {
		const missionVM = build("MissionInline");
		const subscribe = vi.spyOn(missionVM, "subscribe");

		const Screen = (): JSX.Element => {
			// A fresh arrow every render — the shape a consumer reaches for first.
			const title = useLankaVM(missionVM, (state) => state.title);
			return <p>{title}</p>;
		};

		const { rerender } = render(<Screen />);
		rerender(<Screen />);
		rerender(<Screen />);
		rerender(<Screen />);

		// The subscription is keyed on `hasSelector`, a boolean that does not move
		// at this call site, not on the selector itself. Keying it on the selector
		// was measured once at 201 subscriptions for 200 renders.
		expect(subscribe).toHaveBeenCalledTimes(1);
	});
});

describe("a selector whose logic changes between renders", () => {
	it("shows the new selection, not the one the previous selector produced", () => {
		const missionVM = build("MissionMultiplier");
		act(() => missionVM.getState().setCount(5));

		const Screen = ({ multiplier }: { multiplier: number }): JSX.Element => {
			const selected = useLankaVM(missionVM, (state) => state.count * multiplier);
			return <p data-testid="val">{selected}</p>;
		};

		const { rerender } = render(<Screen multiplier={2} />);
		expect(screen.getByTestId("val").textContent).toBe("10");

		rerender(<Screen multiplier={3} />);

		// The state object never changed; only the selector's closure did. The
		// selection is memoised per state object, and the memo is keyed on the
		// selector's identity so this cannot answer the stale value.
		expect(screen.getByTestId("val").textContent).toBe("15");
	});
});

describe("the tracker built once per mounted component", () => {
	it("keeps a previously-read key alive through a render that reads nothing", () => {
		const missionVM = build("MissionTracker");
		const renders = vi.fn();

		const Screen = ({ readWatched }: { readWatched: boolean }) => {
			const state = useLankaVM(missionVM);
			renders();
			if (readWatched) void state.watched;

			return null;
		};

		const { rerender } = render(<Screen readWatched={true} />);
		// A render that touches nothing on the returned proxy: the recorded key
		// from the FIRST render must survive it. It can only survive in the SAME
		// tracker instance — the ref this hook builds lazily and never rebuilds.
		rerender(<Screen readWatched={false} />);
		const before = renders.mock.calls.length;

		act(() => missionVM.getState().bumpIgnored());

		// A tracker rebuilt fresh on the no-op render would have reset its
		// recorded keys to empty, and an empty set means "notify for everything" —
		// exactly the render this must not produce for an untouched key.
		expect(renders.mock.calls.length).toBe(before);
	});
});

describe("a DIFFERENT ViewModel at the same mount point", () => {
	it("reads the new ViewModel, not the one the component mounted with", () => {
		/*
		 * The defect: `createLankaAccessTracker` closes over the ViewModel it was
		 * given, permanently, and the tracker was built once per mounted component
		 * and never rebuilt. A component handed a second ViewModel as a prop — an
		 * ordinary thing for a screen keyed on a route — kept reading the first
		 * one's state for ever.
		 *
		 * It looked like it worked: `subscribe` IS rebuilt for the new ViewModel,
		 * so the component woke on the new one's changes and then re-read the old
		 * one. A live subscription and a frozen screen, with no error anywhere.
		 */
		const first = build("MissionFirst", "alpha");
		const second = build("MissionSecond", "beta");

		const Screen = ({
			viewModel,
		}: {
			viewModel: ILankaReadableVM<IMissionState & IMissionActions>;
		}): JSX.Element => {
			const { title } = useLankaVM(viewModel);

			return <p data-testid="title">{title}</p>;
		};

		const { rerender } = render(<Screen viewModel={first} />);
		expect(screen.getByTestId("title").textContent).toBe("alpha");

		rerender(<Screen viewModel={second} />);

		expect(screen.getByTestId("title").textContent).toBe("beta");
	});

	it("follows the NEW ViewModel's changes and is deaf to the old one's", () => {
		// The other half, and the one that says the swap released as well as
		// acquired: a component still listening to the ViewModel it left is a
		// render caused by a store the screen is no longer showing.
		const first = build("MissionLeaving", "alpha");
		const second = build("MissionArriving", "beta");
		const renders = vi.fn();

		const Screen = ({
			viewModel,
		}: {
			viewModel: ILankaReadableVM<IMissionState & IMissionActions>;
		}): JSX.Element => {
			const { title } = useLankaVM(viewModel);
			renders();

			return <p data-testid="title">{title}</p>;
		};

		const { rerender } = render(<Screen viewModel={first} />);
		rerender(<Screen viewModel={second} />);

		act(() => second.getState().rename("beta prime"));
		expect(screen.getByTestId("title").textContent).toBe("beta prime");

		const before = renders.mock.calls.length;
		act(() => first.getState().rename("alpha prime"));

		expect(renders.mock.calls.length).toBe(before);
		expect(screen.getByTestId("title").textContent).toBe("beta prime");
	});
});

describe("under StrictMode, which mounts twice and throws the first away", () => {
	it("still reads the ViewModel, and still skips a key nothing read", () => {
		/*
		 * The scenario the source's own comment argues about rather than proves.
		 *
		 * The tracker lives in a `useMemo`, and a memo is a performance hint React
		 * is allowed to discard. The argument written beside it is that a discard
		 * takes `subscribe` with it, so the two cannot end up disagreeing — and
		 * `StrictMode` is the one place a developer can make React do it on
		 * purpose: it mounts, tears down and remounts every component in
		 * development, which is exactly what an application ships its tests
		 * against.
		 *
		 * What is asserted is both halves. That it reads at all catches a tracker
		 * left pointing at a disposed render; that it still SKIPS catches the
		 * opposite failure — a recording thrown away silently turns access
		 * tracking off, because a reader that has read nothing is notified of
		 * everything, and a screen that merely repaints too often looks fine.
		 */
		const missionVM = build("MissionStrict", "alpha");
		const renders = vi.fn();

		const Screen = (): JSX.Element => {
			const { title } = useLankaVM(missionVM);
			renders();

			return <p data-testid="title">{title}</p>;
		};

		render(
			<StrictMode>
				<Screen />
			</StrictMode>,
		);

		act(() => missionVM.getState().rename("beta"));
		expect(screen.getByTestId("title").textContent).toBe("beta");

		const before = renders.mock.calls.length;
		act(() => missionVM.getState().bumpIgnored());

		expect(renders.mock.calls.length).toBe(before);
	});
});
