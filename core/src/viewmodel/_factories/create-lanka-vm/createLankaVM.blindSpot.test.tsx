import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLankaVM } from "./createLankaVM";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

/**
 * The access-tracking blind spot: a screen that silently stops updating.
 *
 * ## The defect
 *
 * A consumer re-renders only for state keys it READ from the returned proxy. An
 * action computing a value through `get()` reads state past the proxy, which
 * never sees it. So a component whose only link to a key goes through such a
 * getter never re-renders: the screen freezes and there is no error.
 *
 * It cannot be fixed in the view: destructuring "for the side effect" reads as
 * dead code and is removed by a refactor, an unused-variable sweep or a lint
 * autofix — after which the screen freezes again.
 *
 * The fix is `enableAccessTrackingOptimization: false`, which has to be
 * remembered. The trap below makes remembering unnecessary: in development the
 * mismatch announces itself.
 */

const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

beforeEach(() => {
	warn.mockClear();
	createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
});

afterEach(() => {
	vi.clearAllMocks();
});

interface IReportState {
	rows: number[];
	expanded: boolean;
}

interface IReportActions {
	toggle: () => void;
	getReportView: () => number[];
}

/** A ViewModel with a getter reading state through `get()` — the defect's source. */
const createReportViewModel = () =>
	createLankaVM<IReportState, IReportActions>({
		name: "ReportVM",
		states: { rows: [], expanded: false },
		createActions: ({ get, set }) => ({
			toggle: () => set({ expanded: !get().expanded }),
			// Reads `expanded` through `get()`, that is past the proxy.
			getReportView: () => (get().expanded ? get().rows : []),
		}),
	});

describe("the blind-spot trap", () => {
	it("warns when a changed key is read only through `get()`", () => {
		const useVM = createReportViewModel();

		function Report() {
			const { getReportView } = useVM();
			return <div>{getReportView().length}</div>;
		}

		render(<Report />);
		useVM.getState().toggle();

		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]?.[0])).toContain("ReportVM");
		expect(String(warn.mock.calls[0]?.[0])).toContain("expanded");
	});

	it("stays silent when the key is read directly — a re-render will follow", () => {
		const useVM = createReportViewModel();

		function Report() {
			const { expanded, getReportView } = useVM();
			return (
				<div>
					{String(expanded)}
					{getReportView().length}
				</div>
			);
		}

		render(<Report />);
		// In act(...): this update DOES reach the component, and React re-rendering
		// outside the test's control is exactly the state the warning describes.
		act(() => {
			useVM.getState().toggle();
		});

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent when tracking is deliberately disabled", () => {
		// The flag is a legitimate decision, not a way around the check: warning
		// about what someone already handled teaches them not to read warnings.
		const useVM = createLankaVM<{ expanded: boolean }, { toggle: () => void }>({
			name: "OptedOutVM",
			enableAccessTrackingOptimization: false,
			states: { expanded: false },
			createActions: ({ get, set }) => ({
				toggle: () => set({ expanded: !get().expanded }),
			}),
		});

		render(<Probe useVM={useVM} />);
		act(() => {
			useVM.getState().toggle();
		});

		expect(warn).not.toHaveBeenCalled();
	});

	it("silent entirely in production", () => {
		// A warning in production is noise in a user's console and work on a hot
		// path. The trap is for whoever writes the code, not whoever uses it.
		createLanka({ host: lankaTestHost, flags: { isProduction: true } });
		const useVM = createReportViewModel();

		function Report() {
			const { getReportView } = useVM();
			return <div>{getReportView().length}</div>;
		}

		render(<Report />);
		useVM.getState().toggle();

		expect(warn).not.toHaveBeenCalled();
	});

	it("stays silent when the changed key has nothing to do with the component", () => {
		// A false positive is more dangerous than silence: a trap that shouts at
		// healthy code gets switched off entirely, together with the cases it
		// exists for. Not reading what you do not need is exactly the work tracking
		// exists for, and warning about it scolds the optimisation for succeeding.
		const useVM = createLankaVM<
			{ rows: number[]; ticks: number },
			{ bumpTicks: () => void; getRows: () => number[] }
		>({
			name: "UnrelatedVM",
			states: { rows: [1], ticks: 0 },
			createActions: ({ get, set }) => ({
				bumpTicks: () => set({ ticks: get().ticks + 1 }),
				getRows: () => get().rows,
			}),
		});

		function List() {
			const { getRows } = useVM();
			return <div>{getRows().length}</div>;
		}

		render(<List />);
		useVM.getState().bumpTicks();

		expect(warn).not.toHaveBeenCalled();
	});

	it("does not warn twice about the same key", () => {
		const useVM = createReportViewModel();

		function Report() {
			const { getReportView } = useVM();
			return <div>{getReportView().length}</div>;
		}

		render(<Report />);
		useVM.getState().toggle();
		useVM.getState().toggle();

		expect(warn).toHaveBeenCalledTimes(1);
	});
});

function Probe({ useVM }: { useVM: () => { expanded: boolean } }) {
	const state = useVM();
	return <div>{String(state.expanded)}</div>;
}
