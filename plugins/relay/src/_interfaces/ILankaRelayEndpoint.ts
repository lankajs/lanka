import type { ILankaRelayEnvelope } from "./ILankaRelayEnvelope";

/** One application on a channel, as the others on it see it. */
export interface ILankaRelayEndpoint {
	readonly id: string;
	/** Takes a delivery from another endpoint; filters it by its own `receive`. */
	accept: (envelope: ILankaRelayEnvelope) => void;
	/** Hands a newcomer the last value of every event this endpoint retains. */
	greet: (newcomer: ILankaRelayEndpoint) => void;
}
