/**
 * The access-tracking optimization: a consumer that destructures the state
 * re-renders only when a field it actually READ changes.
 *
 * This is the mechanism every render-cost test in the app ultimately rests on, and
 * the reason ViewModels must preserve reference identity on no-op writes — the
 * tracker compares tracked keys with `Object.is`, so a fresh reference for
 * identical data is indistinguishable from a real change.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printViewModelLog: vi.fn(),
	},
}));

import { createLankaVM } from "./createLankaVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
describe("createLankaVM — access-tracking render optimization", () => {
	// Kept spied so the real bootstrap registry is not touched by these tests.
	vi.spyOn(lankaScenarioBootstrap, "registerViewModel");

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("re-renders only when accessed fields change for no-selector usage", () => {
		const store = createLankaVM({
			name: "TrackedRenderVM",
			states: { count: 0, other: 0 },
			createActions: () => ({}),
		});

		const renderSpy = vi.fn();

		const hook = renderHook(() => {
			const state = store();
			renderSpy(state.count);
			return state.count;
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			store.setState({ other: 1 });
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			store.setState({ count: 1 });
		});

		expect(hook.result.current).toBe(1);
		expect(renderSpy).toHaveBeenCalledTimes(2);
	});

	it("can disable no-selector tracking optimization per ViewModel", () => {
		const store = createLankaVM({
			name: "UntrackedRenderVM",
			enableAccessTrackingOptimization: false,
			states: { count: 0, other: 0 },
			createActions: () => ({}),
		});

		const renderSpy = vi.fn();

		const hook = renderHook(() => {
			const state = store();
			renderSpy(state.count);
			return state.count;
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			store.setState({ other: 1 });
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(2);
	});

	/**
	 * The blind spot behind the "stuck report toggles" bug: a component whose only
	 * link to a state key is a DERIVED action never re-renders when that key
	 * changes, because the action reads the store through `get()` and the tracking
	 * proxy never sees it. Pinned in both directions so the escape hatch documented
	 * on `createLankaVM` stays true.
	 */
	it("does NOT re-render when the only read is a derived action (documented blind spot)", () => {
		const store = createLankaVM<{ hidden: number }, { getDerived: () => number }>({
			name: "DerivedGetterBlindSpotVM",
			states: { hidden: 0 },
			createActions: ({ get }) => ({
				getDerived: () => get().hidden * 2,
			}),
		});

		const renderSpy = vi.fn();

		renderHook(() => {
			const state = store();
			renderSpy(state.getDerived());
		});

		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			store.setState({ hidden: 1 });
		});

		// The derived value changed, the component did not re-render.
		expect(renderSpy).toHaveBeenCalledTimes(1);
	});

	it("re-renders once the component also reads the key the derived action depends on", () => {
		const store = createLankaVM<{ hidden: number }, { getDerived: () => number }>({
			name: "DerivedGetterTrackedVM",
			states: { hidden: 0 },
			createActions: ({ get }) => ({
				getDerived: () => get().hidden * 2,
			}),
		});

		const renderSpy = vi.fn();

		renderHook(() => {
			const state = store();
			// Exactly what MeetingReportEditPage does: touch the dependency so the
			// tracker registers it, then call the derived getter.
			void state.hidden;
			renderSpy(state.getDerived());
		});

		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			store.setState({ hidden: 1 });
		});

		expect(renderSpy).toHaveBeenCalledTimes(2);
		expect(renderSpy).toHaveBeenLastCalledWith(2);
	});
});
