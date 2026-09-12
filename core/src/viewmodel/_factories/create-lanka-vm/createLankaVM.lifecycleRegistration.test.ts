/**
 * A ViewModel's lifecycle hooks reach bootstrap whether or not it has scenarios.
 *
 * `onInit` runs inside `initializeScenario`, and only bootstrap calls that — on
 * the ViewModels it was told about. Registration used to require scenario
 * bindings, so a ViewModel declaring `onInit` and nothing else was never
 * initialised: no error, no log, a hook that simply did not run. Found by a
 * ViewModel that subscribed to an external cache in `onInit` and read nothing.
 *
 * Cross-cutting on purpose: the three families and both styles go through the
 * REAL bootstrap here, because the per-factory specs mock or spy it and so could
 * only ever prove that the hook works once somebody calls it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { startLanka } from "../../../bootstrap/start-lanka/startLanka";
import { resetActiveLanka } from "../../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { ALankaVM } from "../../_abstractions/lanka-vm/ALankaVM";
import { ALankaStatelessVM } from "../../_abstractions/lanka-stateless-vm/ALankaStatelessVM";
import { ALankaSharedStoreVM } from "../../_abstractions/lanka-shared-store-vm/ALankaSharedStoreVM";
import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";
import { createLankaVM } from "./createLankaVM";
import { createLazyLankaVM } from "../create-lazy-lanka-vm/createLazyLankaVM";

interface ICounterState {
	n: number;
}

class CounterStore extends ALankaSharedStore<ICounterState> {
	constructor() {
		super(() => ({ n: 0 }));
	}
}

describe("ViewModel lifecycle hooks — registration with bootstrap", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		resetActiveLanka();
	});

	it("bootstrap calls onInit once on a functional ViewModel that declares only onInit", async () => {
		const onInit = vi.fn();
		createLankaVM({ name: "InitOnlyVM", states: { n: 0 }, createActions: () => ({}), onInit });

		await startLanka();

		expect(onInit).toHaveBeenCalledOnce();
	});

	it("a lazy ViewModel with hooks is initialised on first access and reset on dispose", async () => {
		const onInit = vi.fn();
		const onReset = vi.fn();
		const useLazyVM = createLazyLankaVM({
			name: "LazyHooksVM",
			states: { n: 0 },
			createActions: () => ({}),
			onInit,
			onReset,
		});

		await startLanka();
		expect(onInit).not.toHaveBeenCalled();

		useLazyVM.getState();
		expect(onInit).toHaveBeenCalledOnce();

		useLazyVM.dispose();
		expect(onReset).toHaveBeenCalledOnce();
	});

	// The largest consequence of registering hook-only ViewModels: the instance's
	// disposal now reaches them, so `onReset` fires where it never did — including
	// at every `resetLanka()` between tests.
	it("disposing the instance calls onReset once on a ViewModel that declares only onReset", async () => {
		const onReset = vi.fn();
		createLankaVM({
			name: "ResetOnlyVM",
			states: { n: 0 },
			createActions: () => ({}),
			onReset,
		});

		const lanka = await startLanka();
		expect(onReset).not.toHaveBeenCalled();

		lanka.dispose();
		expect(onReset).toHaveBeenCalledOnce();
	});

	// An override one class up is still an override: the comparison is against the
	// environment's default, not against the direct parent.
	it("bootstrap calls onInit on a ViewModel whose intermediate base overrides it", async () => {
		const seen = vi.fn();

		abstract class HookedBase extends ALankaVM<ICounterState, Record<string, never>> {
			protected override states(): ICounterState {
				return { n: 0 };
			}

			protected createActions(): Record<string, never> {
				return {};
			}

			protected override onInit(): void {
				seen();
			}
		}

		class LeafVM extends HookedBase {
			protected readonly name = "LeafVM";
		}

		new LeafVM().build();
		await startLanka();

		expect(seen).toHaveBeenCalledOnce();
	});

	it("bootstrap calls onInit once on a class shared-store ViewModel that overrides only onInit", async () => {
		const seen = vi.fn();

		class HookedSharedVM extends ALankaSharedStoreVM<
			ICounterState,
			Record<string, never>,
			CounterStore
		> {
			protected readonly name = "HookedSharedInitVM";

			protected createActions(): Record<string, never> {
				return {};
			}

			protected override onInit(): void {
				seen();
			}
		}

		new HookedSharedVM(new CounterStore()).build();
		await startLanka();

		expect(seen).toHaveBeenCalledOnce();
	});

	it("bootstrap calls onInit once on a class ViewModel that overrides only onInit", async () => {
		const seen = vi.fn();

		class HookedVM extends ALankaVM<ICounterState, Record<string, never>> {
			protected readonly name = "HookedVM";

			protected override states(): ICounterState {
				return { n: 0 };
			}

			protected createActions(): Record<string, never> {
				return {};
			}

			protected override onInit(): void {
				seen();
			}
		}

		new HookedVM().build();
		await startLanka();

		expect(seen).toHaveBeenCalledOnce();
	});

	it("bootstrap calls onInit once on a class stateless ViewModel that overrides only onInit", async () => {
		const seen = vi.fn();

		class HookedStatelessVM extends ALankaStatelessVM<Record<string, never>> {
			protected readonly name = "HookedStatelessVM";

			protected createActions(): Record<string, never> {
				return {};
			}

			protected override onInit(): void {
				seen();
			}
		}

		new HookedStatelessVM().build();
		await startLanka();

		expect(seen).toHaveBeenCalledOnce();
	});

	it("registers a class shared-store ViewModel that overrides only onReset", async () => {
		const register = vi.spyOn(lankaScenarioBootstrap, "registerViewModel");

		class HookedSharedVM extends ALankaSharedStoreVM<
			ICounterState,
			Record<string, never>,
			CounterStore
		> {
			protected readonly name = "HookedSharedVM";

			protected createActions(): Record<string, never> {
				return {};
			}

			protected override onReset(): void {}
		}

		new HookedSharedVM(new CounterStore()).build();

		expect(register).toHaveBeenCalledWith(expect.anything(), "HookedSharedVM");
	});

	// Registering every ViewModel would turn the scenario registry into a list of
	// all of them and make bootstrap walk it for nothing: only a hook or a binding
	// earns a place.
	it("does not register a class ViewModel that overrides neither hook and binds nothing", () => {
		const register = vi.spyOn(lankaScenarioBootstrap, "registerViewModel");

		class PlainVM extends ALankaVM<ICounterState, Record<string, never>> {
			protected readonly name = "PlainVM";

			protected override states(): ICounterState {
				return { n: 0 };
			}

			protected createActions(): Record<string, never> {
				return {};
			}
		}

		class PlainStatelessVM extends ALankaStatelessVM<Record<string, never>> {
			protected readonly name = "PlainStatelessVM";

			protected createActions(): Record<string, never> {
				return {};
			}
		}

		class PlainSharedVM extends ALankaSharedStoreVM<
			ICounterState,
			Record<string, never>,
			CounterStore
		> {
			protected readonly name = "PlainSharedVM";

			protected createActions(): Record<string, never> {
				return {};
			}
		}

		new PlainVM().build();
		new PlainStatelessVM().build();
		new PlainSharedVM(new CounterStore()).build();

		expect(register).not.toHaveBeenCalled();
	});
});
