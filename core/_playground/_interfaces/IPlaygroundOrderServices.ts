import type { IPlaygroundReadCache } from "./IPlaygroundReadCache";

/**
 * What the edit ViewModel is handed beside its gateway.
 *
 * `null` is the application without a cache: the ViewModel reads the gateway
 * directly and hears about other screens through scenarios alone. With one, it
 * reads through the cache and hears it too. Same ViewModel, one more listener.
 */
export interface IPlaygroundOrderServices {
	cache: IPlaygroundReadCache | null;
}
