import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStatelessLankaVM } from "./createStatelessLankaVM";
import type { JSX } from "react";

/**
 * Orchestration with no reactive fields, declared in one line.
 *
 * A stateless ViewModel holds actions and nothing else, so what the call answers
 * is the actions — which is what it answered when a ViewModel WAS a hook, and
 * the reason `const { track } = useTrackerVM()` keeps working.
 */
afterEach(cleanup);

interface ITrackerActions {
	track: (what: string) => void;
}

describe("createStatelessLankaVM (React)", () => {
	it("answers the actions, in a component and outside one", () => {
		const seen: string[] = [];
		const useTrackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: (what: string) => seen.push(what) }),
		});

		const Screen = (): JSX.Element => {
			const { track } = useTrackerVM();

			track("render");

			return <p>{seen.length}</p>;
		};

		render(<Screen />);
		expect(seen).toContain("render");
		expect(screen.getByText(String(seen.length))).toBeDefined();

		useTrackerVM.getState().track("outside");
		expect(seen).toContain("outside");
	});

	it("is the ViewModel: name, subscribe and the scenario members", () => {
		const useTrackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: vi.fn() }),
		});

		expect(useTrackerVM.name).toBe("TrackerVM");
		expect(typeof useTrackerVM.subscribe).toBe("function");
		expect(typeof useTrackerVM.getState().track).toBe("function");
	});
});
