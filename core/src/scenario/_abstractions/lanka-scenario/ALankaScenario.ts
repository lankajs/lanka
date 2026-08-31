import type { TLankaReplayRequest } from "../../event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import { ILankaScenario } from "../../_interfaces/ILankaScenario";
import { LankaScenariosRegistry } from "../../_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { lankaEventBus } from "../../event-bus/_facades/lanka-event-bus/lankaEventBus";

/**
 * The base of a scenario — a named unit of coordination over the event bus.
 *
 * A subclass declares `name`, `eventType` and `dataTypeName`, calls `trigger()`
 * when the event happens, and ViewModels subscribe to it and unsubscribe.
 *
 * Scenarios register THEMSELVES unless the subclass sets the static
 * `skipAutoRegistration`.
 *
 * ```ts
 * export class SessionUpdated extends ALankaScenario<TSession> {
 *   readonly name = "SessionUpdated";
 *   readonly eventType = "session.updated";
 *   readonly dataTypeName = "TSession";
 * }
 * ```
 */
export abstract class ALankaScenario<TData = void> implements ILankaScenario<TData> {
	abstract readonly name: string;
	abstract readonly eventType: string;
	abstract readonly dataTypeName: string;

	/** A subclass sets this to opt out of self-registration. */
	static skipAutoRegistration?: boolean;

	/**
	 * The self-registration pool.
	 *
	 * Class-level deliberately: a registry of DEFINITIONS, not runtime state. The
	 * classes come from one barrel and both framework instances must see the same
	 * list — splitting it would be divergence, not isolation.
	 */
	private static autoRegisteredScenarios: Set<ALankaScenario<unknown>> = new Set();

	/** Registers the scenario itself unless the subclass opted out. */
	constructor() {
		// The constructor comes from the actual class, that is the subclass.
		const constructor = this.constructor as typeof ALankaScenario;

		// Register unless opted out.
		if (!constructor.skipAutoRegistration) {
			ALankaScenario.autoRegisteredScenarios.add(this);
		}
	}

	/**
	 * Every scenario that registered itself.
	 *
	 * @internal
	 */
	public static getAutoRegisteredScenarios(): ALankaScenario<unknown>[] {
		return Array.from(ALankaScenario.autoRegisteredScenarios);
	}

	/**
	 * Clears the auto-registration pool. Required by tests.
	 * @internal
	 */
	public static clearAutoRegisteredScenarios(): void {
		ALankaScenario.autoRegisteredScenarios.clear();
	}

	/**
	 * Registers the scenario by hand.
	 *
	 * @returns `false` when it was already registered
	 */
	public register(): boolean {
		return LankaScenariosRegistry.getInstance().register(this);
	}

	/**
	 * Removes the scenario from the registry.
	 *
	 * @returns `false` when it was not there
	 */
	public unregister(): boolean {
		return LankaScenariosRegistry.getInstance().unregister(this.name);
	}

	trigger(data?: TData): void {
		lankaLogger.printScenarioLog("TRIGGER Scenario", this.name, data);
		lankaEventBus.dispatch(this.eventType, data, this.name);
	}

	/**
	 * Subscribes a handler and returns an unsubscribe function.
	 *
	 * Without the return, unsubscribing is possible only by callback identity, and
	 * every ViewModel factory has to keep a map of references for it.
	 */
	subscribe(
		callback: (data?: TData) => void,
		options?: {
			priority?: number;
			replay?: TLankaReplayRequest;
			usedBy?: string;
		},
	): () => void {
		lankaLogger.printScenarioLog("SUBSCRIBE Scenario", this.name, this.dataTypeName);
		return lankaEventBus.subscribe(this.eventType, callback, {
			...options,
			usedBy: options?.usedBy ?? this.name,
		});
	}
}
