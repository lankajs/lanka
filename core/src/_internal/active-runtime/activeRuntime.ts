import type { LankaEventBusInstance } from "../../scenario/event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import type { LankaScenariosRegistry } from "../../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import type { LankaScenarioVMRegistry } from "../../scenario/_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import type { ILankaRuntimeConfig } from "../../config/_interfaces/ILankaRuntimeConfig";
import type { ILankaInFlightCounter } from "../../gateway/inflight/lankaHttpInFlight";
import type { ILankaScenarioVM } from "../../scenario/_interfaces/ILankaScenarioVM";
import type { TLankaRequestMiddleware } from "../../gateway/request/lankaRequestMiddleware";
import type { LankaGatewayLocator } from "../../locator/gateway/lanka-gateway-locator/LankaGatewayLocator";
import type { LankaScenarioLocator } from "../../locator/scenario/lanka-scenario-locator/LankaScenarioLocator";
import type { LankaSingletonLocator } from "../../locator/singleton/lanka-singleton-locator/LankaSingletonLocator";
import type { LankaSharedStoreLocator } from "../../locator/shared-store/lanka-shared-store-locator/LankaSharedStoreLocator";

/**
 * The pointer to the framework instance that ambient facades resolve to.
 *
 * ## Why this module is separate and imports no value
 *
 * Framework state belongs to an instance (`createLanka`), but the callers of
 * `lankaEventBus.dispatch`, `getLankaFlags()`, `lankaSingletons.foo`, `lankaHttpInFlight` —
 * the ambient facades cannot hold one — a user-extended `ALankaScenario`, the
 * static `LankaScenarioBootstrap` — so they ask which instance is active.
 *
 * The module is dependency-free DELIBERATELY: every import here is `import type`
 * and disappears at compile time. Otherwise there would be a cycle
 * `createLanka → locator → gateway → config → createLanka`, and module
 * evaluation order would start deciding what ends up `undefined`.
 *
 * This is still a global pointer. Real isolation belongs to whoever holds an
 * instance: their own bus, registries and counter. The facades serve ONE active
 * instance — exactly what an application with one needs.
 */
export interface ILankaRuntime {
	readonly eventBus: LankaEventBusInstance;
	readonly scenarios: LankaScenariosRegistry;
	readonly viewModels: LankaScenarioVMRegistry;
	readonly inFlight: ILankaInFlightCounter;
	/**
	 * Request wrappers, in registration order: the first wraps them all.
	 *
	 * An array, not a set: order carries meaning — retry must sit outside request
	 * signing, or the second attempt goes out unsigned.
	 */
	readonly requestMiddleware: readonly TLankaRequestMiddleware[];
	/** Default response deadline. `undefined` means no limit. */
	readonly requestTimeoutMs: number | undefined;
	readonly locators: {
		readonly gateways: LankaGatewayLocator;
		readonly scenarios: LankaScenarioLocator;
		readonly singletons: LankaSingletonLocator;
		readonly sharedStores: LankaSharedStoreLocator;
	};
	readonly config: ILankaRuntimeConfig;
	/**
	 * Bootstrap state of the scenario layer.
	 *
	 * A mutable object rather than contract fields: `LankaScenarioBootstrap` is an
	 * ambient facade and must write here without holding an instance.
	 */
	readonly scenarioState: {
		bootstrapped: boolean;
		initialized: WeakSet<ILankaScenarioVM>;
	};
	setConfig(patch: ILankaRuntimeConfig): void;
	getFlags(): NonNullable<ILankaRuntimeConfig["flags"]>;
}

/**
 * How "which instance is active" is answered.
 *
 * A strategy, because the answer depends on where the code runs. In a browser
 * there is one instance per document and a module-level pointer IS the answer. In
 * a server process there is one instance per REQUEST, and a module-level pointer
 * is the bug: the last request to start would answer for all of them.
 */
export type TLankaRuntimeResolver = () => ILankaRuntime | null;

let active: ILankaRuntime | null = null;
let resolveRuntime: TLankaRuntimeResolver | null = null;

export function setActiveRuntime(runtime: ILankaRuntime | null): void {
	active = runtime;
}

/**
 * Replaces the strategy, or restores the default one with `null`.
 *
 * The installed resolver is the WHOLE answer — the module-level pointer is not
 * consulted behind it. That is deliberate: a fallback would turn "this ran
 * outside a request" from a loud error into one request quietly reading another
 * request's instance, which is the failure this seam exists to make impossible.
 *
 * Core ships no resolver and knows of none. What installs one is a package that
 * knows the shape of a request; core knows only that the question has more than
 * one answer.
 */
export function setLankaRuntimeResolver(resolver: TLankaRuntimeResolver | null): void {
	resolveRuntime = resolver;
}

export function getActiveRuntime(): ILankaRuntime | null {
	return resolveRuntime ? resolveRuntime() : active;
}

/**
 * The active instance, or a loud failure.
 *
 * No fallback, deliberately, for the same reason `getLankaHost` has none: an
 * instance created silently on the fly would mean subscriptions went to one bus
 * and events to another, and the divergence would surface three layers away.
 */
export function requireActiveRuntime(): ILankaRuntime {
	// The strategy is read here rather than through `getActiveRuntime()`: this is
	// the hottest path in the framework — every ambient facade, every request,
	// every dispatch — and a call that only forwards is a call that shows up in
	// `perf/`.
	const runtime = resolveRuntime ? resolveRuntime() : active;

	if (!runtime) {
		throw new Error(
			resolveRuntime
				? "lanka has no instance for this call. A runtime resolver is installed and " +
						"answered with none, which on a server means the code ran outside a " +
						"request scope — start one, or do this work inside it."
				: "lanka used before an instance existed. Call createLanka({ host }) and " +
						"activate it.",
		);
	}

	return runtime;
}
