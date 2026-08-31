import { LankaChunkPreload } from "../../lanka-chunk-preload/LankaChunkPreload";
import { LankaDataWarmup } from "../../warmup/LankaDataWarmup";
import { LankaIntentPrefetch } from "../../lanka-intent-prefetch/LankaIntentPrefetch";
import type { ILankaPrefetchConfig } from "../../lanka-prefetch/lankaPrefetch";

/** The three tiers, already wired to the counters they yield to. */
export interface ILankaPrefetchTiers {
	intent: LankaIntentPrefetch;
	chunk: LankaChunkPreload;
	warmup: LankaDataWarmup;
}

/**
 * Builds the three tiers and their DIFFERENT views of how busy the wire is.
 *
 * Each tier gets its own term, and the differences are the whole ladder:
 *
 * - a chunk yields to real requests — the type forbids a consumer from setting
 *   this BECAUSE the plugin does, and for a while it did not, so the sweeper
 *   never saw the wire and the ladder held for two rungs of three while every
 *   unit test stayed green;
 * - the intent buffer counts its own in-flight requests and subtracts them, or
 *   it would see its own traffic as foreign and stop itself;
 * - warm-up adds the chunk term, without which it would read the wire as quiet
 *   mid-sweep and "code first, then data" would rest on a head start rather
 *   than a gate.
 *
 * `activeRequests` is a FUNCTION rather than a number: the framework instance
 * arrives in `install`, after the tiers exist, and a counter read in a
 * constructor is read once and forever.
 */
export const createLankaPrefetchTiers = (
	config: ILankaPrefetchConfig,
	activeRequests: () => number,
): ILankaPrefetchTiers => {
	const chunk = new LankaChunkPreload({
		...config.chunk,
		activeRequests: () => activeRequests(),
	});

	const intent = new LankaIntentPrefetch({
		...config.intent,
		activeRequests: () => activeRequests(),
	});

	const warmup = new LankaDataWarmup({
		...config.warmup,
		activeRequests: () => activeRequests() + chunk.getActiveCount(),
	});

	return { intent, chunk, warmup };
};
