import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { render } from "@testing-library/vue";
import { createStatelessLankaVM } from "./createStatelessLankaVM";

/**
 * Orchestration with no reactive fields, declared in one line.
 *
 * A stateless ViewModel holds actions and nothing else, so what the call answers
 * is a ref over the actions — the same shape `useLankaVM` answers for every
 * other ViewModel in this package, which is the point: the six factories change
 * where a declaration is imported from and nothing about what reading it means.
 */
interface ITrackerActions {
	track: (what: string) => void;
}

describe("createStatelessLankaVM (Vue)", () => {
	it("answers the actions, in a component and outside one", () => {
		const seen: string[] = [];
		const useTrackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: (what: string) => seen.push(what) }),
		});

		const Screen = defineComponent({
			setup() {
				const state = useTrackerVM();

				state.value.track("render");

				return () => h("p", String(seen.length));
			},
		});

		const { getByText } = render(Screen);
		expect(seen).toContain("render");
		expect(getByText(String(seen.length))).toBeDefined();

		useTrackerVM.getState().track("outside");
		expect(seen).toContain("outside");
	});

	it("is the ViewModel: name, subscribe and the actions off `getState`", () => {
		const useTrackerVM = createStatelessLankaVM<ITrackerActions>({
			name: "TrackerVM",
			createActions: () => ({ track: vi.fn() }),
		});

		expect(useTrackerVM.name).toBe("TrackerVM");
		expect(typeof useTrackerVM.subscribe).toBe("function");
		expect(typeof useTrackerVM.getState().track).toBe("function");
	});
});
