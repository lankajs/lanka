import type { ILankaRelayEnvelope } from "./ILankaRelayEnvelope";

/** One application on a channel, as the others on it see it. */
export interface ILankaRelayEndpoint {
	readonly id: string;
	/** Takes a delivery from another endpoint; filters it by its own `receive`. */
	accept: (envelope: ILankaRelayEnvelope) => void;
	/**
	 * What this endpoint retains, as event type → the page-wide stamp of the
	 * value it holds. The channel reads it to pick ONE holder per type.
	 */
	retained: () => ReadonlyMap<string, number>;
	/** Hands a newcomer the value it retains for one event type. */
	handOver: (newcomer: ILankaRelayEndpoint, eventType: string) => void;
}
