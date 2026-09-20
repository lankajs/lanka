import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { createStatelessLankaVM } from "./createStatelessLankaVM";

/**
 * Orchestration with no reactive fields, declared in one line.
 *
 * A stateless ViewModel holds actions and nothing else, so what the accessor
 * answers is the actions — read inside a component the same way every other
 * shape here is read, and read outside one through `getState()`.
 */
afterEach(cleanup);

interface ITrackerActions {
	track: (what: string) => void;
}

describe("createStatelessLankaVM (Solid)", () => {
	it("answers the actions, in a component and outside one", () => {
		const seen: string[] = [];
		const useTrackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: (what: string) => seen.push(what) }),
		});

		const Screen = () => {
			const actions = useTrackerVM();

			actions().track("render");

			return <p>{seen.length}</p>;
		};

		render(() => <Screen />);
		expect(seen).toContain("render");
		expect(screen.getByText(String(seen.length))).toBeTruthy();

		useTrackerVM.getState().track("outside");
		expect(seen).toContain("outside");
	});

	it("is the ViewModel: name, subscribe and the actions themselves", () => {
		const useTrackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: vi.fn() }),
		});

		expect(useTrackerVM.name).toBe("TrackerVM");
		expect(typeof useTrackerVM.subscribe).toBe("function");
		expect(typeof useTrackerVM.getState().track).toBe("function");
	});
});
