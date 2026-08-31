import type { TLankaReplayRequest } from "../event-bus/lanka-event-bus-instance/LankaEventBusInstance";
/**
 * A scenario: a named unit of coordination over the event bus.
 *
 * This is how ViewModels talk to each other without knowing about each other.
 *
 * @template TData The data that travels with the event
 */
export interface ILankaScenario<TData = void> {
	/** The scenario's name, and the key it is found by. */
	readonly name: string;

	/** The event type on the bus. */
	readonly eventType: string;

	/** The event data's type name — for the bus metadata. */
	readonly dataTypeName: string;

	/**
	 * Announces that the scenario happened.
	 *
	 * @param data What travels with the event
	 */
	trigger(data?: TData): void;

	/**
	 * Subscribes a handler and returns an unsubscribe function.
	 *
	 * The return is the only way to remove EXACTLY this subscription: by callback,
	 * two subscriptions of one function are indistinguishable.
	 */
	subscribe(
		callback: (data?: TData) => void,
		options?: {
			priority?: number;
			replay?: TLankaReplayRequest;
			usedBy?: string;
		},
	): () => void;

	/** Called when the scenario is registered, if declared. */
	initialize?(): void;

	/** Called when the scenario is removed from the registry, if declared. */
	cleanup?(): void;
}
