import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";
import { createSharedStoreLankaVM } from "./createSharedStoreLankaVM";

interface ITrackedSharedState {
	count: number;
	other: number;
}

class TrackedSharedStore extends ALankaSharedStore<ITrackedSharedState> {
	constructor() {
		super(() => ({ count: 0, other: 0 }));
	}
}

describe("createSharedStoreLankaVM — render optimization (access tracking)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("re-renders only when accessed fields change for no-selector usage", () => {
		const sharedStore = new TrackedSharedStore();

		const vm = createSharedStoreLankaVM<
			ITrackedSharedState,
			Record<string, never>,
			TrackedSharedStore
		>({
			name: "TrackedSharedVM",
			store: sharedStore,
			createActions: () => ({}),
		});

		const renderSpy = vi.fn();
		const hook = renderHook(() => {
			const state = vm();
			renderSpy(state.count);
			return state.count;
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			sharedStore.setState({ other: 1 });
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			sharedStore.setState({ count: 1 });
		});

		expect(hook.result.current).toBe(1);
		expect(renderSpy).toHaveBeenCalledTimes(2);
	});

	it("can disable no-selector tracking optimization per shared-store ViewModel", () => {
		const sharedStore = new TrackedSharedStore();

		const vm = createSharedStoreLankaVM<
			ITrackedSharedState,
			Record<string, never>,
			TrackedSharedStore
		>({
			name: "UntrackedSharedVM",
			enableAccessTrackingOptimization: false,
			store: sharedStore,
			createActions: () => ({}),
		});

		const renderSpy = vi.fn();
		const hook = renderHook(() => {
			const state = vm();
			renderSpy(state.count);
			return state.count;
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(1);

		act(() => {
			sharedStore.setState({ other: 1 });
		});

		expect(hook.result.current).toBe(0);
		expect(renderSpy).toHaveBeenCalledTimes(2);
	});
});
