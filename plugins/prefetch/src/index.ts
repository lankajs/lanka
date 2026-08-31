/**
 * @lankajs/plugin-prefetch — the network priority ladder, enforced by code.
 *
 * ```
 * SSE  >  ordinary request  >  route chunk  >  data warm-up  >  intent buffer
 * ```
 *
 * ## A plugin, not a module
 *
 * It needs the in-flight request counter, which lives in core and is fed at the
 * single send point. Without a hook the ladder could only be described in core
 * and enforced outside it.
 *
 * ## Three tiers, three counters
 *
 * The request counter is in core; the chunk counter is here, because a chunk is
 * pulled by a dynamic `import()` and never passes the request layer; and the
 * intent buffer counts its own in-flight requests and subtracts them from the
 * total, or it would see its own traffic as foreign and stop itself.
 */

export { lankaPrefetch } from "./lanka-prefetch/lankaPrefetch";
export type { ILankaPrefetchConfig, ILankaPrefetchPlugin } from "./lanka-prefetch/lankaPrefetch";

export { LankaIntentPrefetch } from "./lanka-intent-prefetch/LankaIntentPrefetch";
export { LankaChunkPreload } from "./lanka-chunk-preload/LankaChunkPreload";
export { LankaDataWarmup } from "./warmup/LankaDataWarmup";
export { defineLankaPrefetchResource } from "./resource/defineLankaPrefetchResource";

export type {
	ILankaIntentPrefetchConfig,
	ILankaIntentPrefetchDiagnostics,
	TLankaActiveRequestProbe,
	TLankaClock,
} from "./lanka-intent-prefetch/LankaIntentPrefetch";
export type {
	ILankaChunkEntry,
	ILankaChunkPreloadConfig,
	ILankaChunkPreloadDiagnostics,
	ILankaIdleScheduler,
	ILankaNetworkConditions,
	ILankaVisibilityConditions,
} from "./lanka-chunk-preload/LankaChunkPreload";
export type {
	ILankaDataWarmupConfig,
	ILankaDataWarmupDiagnostics,
	ILankaWarmupTask,
} from "./warmup/LankaDataWarmup";
export type {
	ILankaPrefetchResource,
	TLankaRouteParams,
} from "./resource/defineLankaPrefetchResource";
