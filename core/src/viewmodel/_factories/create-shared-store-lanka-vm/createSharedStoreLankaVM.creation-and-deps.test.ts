import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";
import { createSharedStoreLankaVM } from "./createSharedStoreLankaVM";

interface ITestSharedState {
	count: number;
}

interface ISharedVmActions {
	increment: () => void;
	getDeps: () => {
		gw: number;
		svc: string;
		count: number;
	};
}

class TestSharedStore extends ALankaSharedStore<ITestSharedState> {
	constructor() {
		super(() => ({ count: 0 }));
	}
}

describe("createSharedStoreLankaVM — creation and dependency resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates actions on top of shared store and resolves gateways/services", () => {
		const sharedStore = new TestSharedStore();

		const vm = createSharedStoreLankaVM<
			ITestSharedState,
			ISharedVmActions,
			TestSharedStore,
			{ gw: number },
			{ svc: string }
		>({
			name: "SharedVM",
			store: sharedStore,
			gateways: () => ({ gw: 123 }),
			services: { svc: "ok" },
			createActions: ({ set, getStore, gateways, services }) => ({
				increment: () =>
					set((state) => ({
						count: state.count + 1,
					})),
				getDeps: () => ({
					gw: gateways.gw,
					svc: services.svc,
					count: getStore().count,
				}),
			}),
		});

		vm.getState().increment();

		expect(vm.getStoreState().count).toBe(1);
		expect(vm.getState().getDeps()).toEqual({
			gw: 123,
			svc: "ok",
			count: 1,
		});
	});

	it("reads latest shared store state through getState", () => {
		const sharedStore = new TestSharedStore();

		const vm = createSharedStoreLankaVM<
			ITestSharedState,
			Record<string, never>,
			TestSharedStore
		>({
			name: "StoreBridgeVM",
			store: sharedStore,
			createActions: () => ({}),
		});

		sharedStore.setState({ count: 7 });

		expect(vm.getState().count).toBe(7);
		expect(vm.getStoreState().count).toBe(7);
	});
});
