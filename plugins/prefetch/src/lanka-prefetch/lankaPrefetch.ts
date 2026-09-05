import { createLankaPrefetchTiers } from "../_internal/create-lanka-prefetch-tiers/createLankaPrefetchTiers";
import type { ILankaPlugin } from "lanka";
import type {
	LankaIntentPrefetch,
	ILankaIntentPrefetchConfig,
} from "../lanka-intent-prefetch/LankaIntentPrefetch";
import type {
	LankaChunkPreload,
	ILankaChunkPreloadConfig,
} from "../lanka-chunk-preload/LankaChunkPreload";
import type { LankaDataWarmup, ILankaDataWarmupConfig } from "../lanka-data-warmup/LankaDataWarmup";

export interface ILankaPrefetchConfig {
	intent?: Omit<ILankaIntentPrefetchConfig, "activeRequests">;
	chunk?: Omit<ILankaChunkPreloadConfig, "activeRequests">;
	warmup?: Omit<ILankaDataWarmupConfig, "activeRequests">;
}

export interface ILankaPrefetchPlugin extends ILankaPlugin {
	/** The intent buffer: warms what the user is already reaching for. */
	readonly intent: LankaIntentPrefetch;
	/** Route chunk sweeping. */
	readonly chunk: LankaChunkPreload;
	/** Batched data warm-up. */
	readonly warmup: LankaDataWarmup;
}

/**
 * The prefetch plugin: three tiers over three counters.
 *
 * The request counter is in core; the chunk counter is here, because a chunk is
 * pulled by a dynamic `import()` and never passes the request layer; and the
 * intent buffer counts its own in-flight requests and subtracts them from the
 * total, or it would see its own traffic as foreign and stop itself.
 */
export const lankaPrefetch = (config: ILankaPrefetchConfig = {}): ILankaPrefetchPlugin => {
	// The counters are wired LAZILY, through a closure: the framework instance
	// arrives in `install` while the services are created before it. Reading the
	// counter in a constructor would read it once and forever.
	let activeRequests: () => number = () => 0;

	const { intent, chunk, warmup } = createLankaPrefetchTiers(config, () => activeRequests());

	return {
		name: "@lankajs/plugin-prefetch",
		intent,
		chunk,
		warmup,
		install(lanka) {
			activeRequests = () => lanka.inFlight.getActiveCount();

			return () => {
				activeRequests = () => 0;
				// The buffer holds ONE user's server responses, which must not outlive
				// the framework instance.
				intent.clear("plugin removed");
			};
		},
	};
};
