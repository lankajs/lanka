import { requireActiveRuntime } from "../../../_internal/active-runtime/activeRuntime";
import { ILankaScenarioVM } from "../../_interfaces/ILankaScenarioVM";

/**
 * The registry of ViewModels that use scenarios.
 *
 * They arrive by themselves: the factory registers a ViewModel when it declares
 * scenario handlers.
 */
export class LankaScenarioVMRegistry {
	private registeredViewModels: Set<ILankaScenarioVM> = new Set();

	/**
	 * Public: the registry belongs to a framework instance rather than to the
	 * module.
	 */
	public constructor() {}

	/**
	 * The active instance's registry, for callers that cannot hold one — the
	 * static `LankaScenarioBootstrap`. Instance holders read `lanka.viewModels`.
	 */
	public static getInstance(): LankaScenarioVMRegistry {
		return requireActiveRuntime().viewModels;
	}

	/** Whether this ViewModel is already registered. */
	public isRegistered(viewModel: ILankaScenarioVM): boolean {
		return this.registeredViewModels.has(viewModel);
	}

	/**
	 * Registers a ViewModel.
	 *
	 * @returns `false` when it was already registered
	 */
	public register(viewModel: ILankaScenarioVM): boolean {
		if (this.registeredViewModels.has(viewModel)) {
			return false;
		}
		this.registeredViewModels.add(viewModel);
		return true;
	}

	/** Removes a ViewModel from the registry. */
	public unregister(viewModel: ILankaScenarioVM): void {
		this.registeredViewModels.delete(viewModel);
	}

	/** Every registered ViewModel. */
	public getAllViewModels(): ILankaScenarioVM[] {
		return Array.from(this.registeredViewModels);
	}

	/**
	 * Clears every registered ViewModel. Required by tests.
	 */
	public clear(): void {
		this.registeredViewModels.clear();
	}

	/**
	 * Unsubscribes every registered ViewModel from its scenarios and clears the
	 * registry.
	 *
	 * Without it tests are not isolated: a subscription leaks from test to test.
	 */
	public resetAll(): void {
		this.registeredViewModels.forEach((vm) => {
			try {
				vm.resetScenario();
			} catch {
				// One failing to reset is no reason to fail the rest.
			}
		});
		this.clear();
	}
}
