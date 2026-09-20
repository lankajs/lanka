/**
 * Orchestration with no reactive fields, declared in one line.
 *
 * A stateless ViewModel holds actions and nothing else, so what the call answers
 * is a view over the actions — and nothing ever invalidates it, because the
 * port's `subscribe` for this shape never calls its listener. That is what lets
 * one reader serve all three ViewModel shapes.
 */
import { describe, expect, it, vi } from "vitest";
import { createStatelessLankaVM } from "./createStatelessLankaVM";

interface ITrackerActions {
	track: (what: string) => void;
}

describe("createStatelessLankaVM (Svelte)", () => {
	it("answers the actions through the binding's read, and outside one", () => {
		const seen: string[] = [];
		const trackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: (what: string) => seen.push(what) }),
		});

		const view = trackerVM();

		view.track("read");
		expect(seen).toEqual(["read"]);

		trackerVM.getState().track("outside");
		expect(seen).toEqual(["read", "outside"]);

		view.stop();
	});

	it("is the ViewModel: name, subscribe and the scenario members", () => {
		const trackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: vi.fn() }),
		});

		expect(trackerVM.name).toBe("TrackerVM");
		expect(typeof trackerVM.subscribe).toBe("function");
		expect(typeof trackerVM.getState().track).toBe("function");
	});
});
