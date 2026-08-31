import type { ILankaScenario } from "../_interfaces/ILankaScenario";
import type { ILankaScenarioVM } from "../_interfaces/ILankaScenarioVM";
import { LankaScenariosRegistry } from "../_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { LankaScenarioVMRegistry } from "../_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import { ALankaScenario } from "../_abstractions/lanka-scenario/ALankaScenario";
import { lankaLogger } from "../../logger/lanka-logger/LankaLogger";

/**
 * Brings up the scenario layer — deliberately React-free.
 *
 * Two jobs: declare every scenario's events on the bus as early as possible,
 * before the first ViewModel exists; and let a ViewModel raise its own
 * subscriptions at construction.
 *
 * Called from the application entry point before ViewModels are imported.
 */

// The barrel of every scenario class: what keeps bootstrap in step with the list.
import * as ScenariosModule from "@lanka_di/Scenarios";
import { lankaEventBus } from "../event-bus/_facades/lanka-event-bus/lankaEventBus";
import {
	getActiveRuntime,
	requireActiveRuntime,
} from "../../_internal/active-runtime/activeRuntime";

/**
 * Bootstrapping the scenario layer, for callers with no instance in hand.
 *
 * An ordinary class with an ordinary instance: the declared-ViewModel list below
 * is deliberately shared across instances — every test builds a new framework and
 * module-level ViewModels are declared once — so the single instance IS the
 * shared list, and a second one would be a second list nobody adopts.
 */
export class LankaScenarioBootstrap {
	/**
	 * The bootstrapped flag and the set of initialised VMs live on the INSTANCE.
	 *
	 * As static fields, a second framework in the same process would exit
	 * `bootstrap()` on someone else's flag — never starting at all, with no symptom
	 * except that no scenario works.
	 */
	private get state() {
		return requireActiveRuntime().scenarioState;
	}

	public isScenarioLayerBootstrapped(): boolean {
		return this.state.bootstrapped;
	}

	private forceInstantiateAllScenarios(): void {
		for (const exported of Object.values(ScenariosModule)) {
			// Only class constructors are relevant.
			if (typeof exported !== "function") continue;

			try {
				// Constructing an ALankaScenario subclass puts it into the
				// self-registration pool — see ALankaScenario.
				new (exported as unknown as new () => unknown)();
			} catch {
				// Not every export is constructible; skip those.
			}
		}
	}

	private registerScenarioEvents(scenarios: ILankaScenario<unknown>[]): void {
		const registeredEventTypes = new Set<string>();

		scenarios.forEach((scenario) => {
			if (!registeredEventTypes.has(scenario.eventType)) {
				registeredEventTypes.add(scenario.eventType);

				lankaLogger.printScenarioLog("REGISTER SCENARIO EVENT", scenario.name);
				lankaEventBus.registerEvent(scenario.eventType, {
					dataType: scenario.dataTypeName,
					description: `Scenario: ${scenario.name}`,
					usedBy: [scenario.name],
					priority: 0,
				});
			}

			if (scenario.initialize) {
				lankaLogger.printScenarioLog("INITIALIZE SCENARIO", scenario.name);
				scenario.initialize();
			}
		});
	}

	private initializeAlreadyCreatedViewModels(): void {
		const viewModels = LankaScenarioVMRegistry.getInstance().getAllViewModels();
		viewModels.forEach((vm) => {
			if (!this.state.initialized.has(vm)) {
				this.state.initialized.add(vm);
				vm.initializeScenario();
			}
		});
	}

	/**
	 * Brings up the scenario layer.
	 *
	 * Constructs the scenario classes so they can be collected, declares their
	 * events on the bus, calls `initialize()` where present, and initialises
	 * ViewModels that already exist — which happens in tests and under unusual
	 * import order.
	 *
	 * Idempotent.
	 */
	public bootstrap(): void {
		if (this.state.bootstrapped) return;

		lankaLogger.printScenarioLog("BOOTSTRAP SCENARIOS START");

		// Instances must exist, or the registry has nothing to collect.
		this.forceInstantiateAllScenarios();

		const registry = LankaScenariosRegistry.getInstance();
		registry.collectAutoRegisteredScenarios();

		const scenarios = registry.getAllScenarios();
		this.registerScenarioEvents(scenarios);

		this.state.bootstrapped = true;

		// Some ViewModels may predate bootstrap — in tests, or under unusual import
		// order; initialise them now.
		this.initializeAlreadyCreatedViewModels();

		lankaLogger.printScenarioLog("BOOTSTRAP SCENARIOS FINISH");
	}

	/**
	 * Called by a ViewModel factory when the ViewModel declares scenario handlers.
	 *
	 * Registers the ViewModel and, if the layer is already up, initialises it
	 * immediately. Duplicate registration and duplicate initialisation are
	 * impossible.
	 *
	 * @param viewModel What to register
	 * @param name Name for the log
	 */
	/**
	 * ViewModels DECLARED in this process.
	 *
	 * Module-level deliberately, the same case as the scenario pool: a registry of
	 * DEFINITIONS, not runtime state. Splitting it between instances would be
	 * divergence, not isolation — the classes come from the same modules and both
	 * instances must see one list.
	 *
	 * Two reasons it exists:
	 *
	 * 1. Declaring a ViewModel is a declaration, not work. A screen file creates it
	 *    at module level, and import order decides whether that happens before or
	 *    after `createLanka()`. Requiring a live instance at declaration time
	 *    requires an import order the consumer does not control.
	 * 2. Instances come one after another: every test creates its own. The list is
	 *    NOT drained by the first — otherwise the second instance would know no
	 *    module-level ViewModel and its `dispose()` would not remove their
	 *    subscriptions, so a test would receive events the previous one subscribed
	 *    to.
	 */
	private readonly declaredViewModels: { viewModel: ILankaScenarioVM; name?: string }[] = [];

	/** Registers everything declared into a NEW instance. Called by `createLanka`. */
	public adoptDeclaredViewModels(): void {
		for (const { viewModel, name } of [...this.declaredViewModels]) {
			this.attachViewModel(viewModel, name);
		}
	}

	public registerViewModel(viewModel: ILankaScenarioVM, name?: string): void {
		const isKnown = this.declaredViewModels.some(
			(declared) => declared.viewModel === viewModel,
		);
		if (!isKnown) this.declaredViewModels.push({ viewModel, name });

		// No instance yet: the declaration came before bootstrap, and whoever
		// bootstraps will pick it up.
		if (!getActiveRuntime()) return;

		this.attachViewModel(viewModel, name);
	}

	private attachViewModel(viewModel: ILankaScenarioVM, name?: string): void {
		const registry = LankaScenarioVMRegistry.getInstance();

		// Already registered — nothing to do.
		if (registry.isRegistered(viewModel)) {
			if (name) {
				lankaLogger.printViewModelLog("VM Already Registered (skipped)", name);
			}
			return;
		}

		// Register it.
		registry.register(viewModel);

		if (name) {
			lankaLogger.printViewModelLog("Register Scenario VM", name);
		}

		// The layer is already up — initialise it now rather than at the next
		// bootstrap.
		if (this.state.bootstrapped) {
			if (!this.state.initialized.has(viewModel)) {
				this.state.initialized.add(viewModel);
				viewModel.initializeScenario();
			}
		}
	}

	/**
	 * Resets the whole scenario layer. Without it tests are not isolated.
	 *
	 * Clears the self-registration list, the scenario registry with its metadata,
	 * the ViewModel registry together with all their subscriptions, and the bus —
	 * events and
	 * middleware.
	 */
	public reset(): void {
		ALankaScenario.clearAutoRegisteredScenarios();
		LankaScenariosRegistry.getInstance().clear();
		LankaScenarioVMRegistry.getInstance().resetAll();
		lankaEventBus.clearAllEvents();
		this.state.bootstrapped = false;
		this.state.initialized = new WeakSet<ILankaScenarioVM>();
	}
}

/** The one every caller wants. */
export const lankaScenarioBootstrap = new LankaScenarioBootstrap();
