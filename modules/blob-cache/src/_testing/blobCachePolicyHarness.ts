import { LankaBlobCachePolicy } from "../lanka-blob-cache-policy/LankaBlobCachePolicy";
import {
	LankaBlobCacheStore,
	type IBlobCacheBackendCandidate,
	type ILankaBlobCacheEnvironment,
} from "../store/lanka-blob-cache-store/LankaBlobCacheStore";
import { BLOB_CACHE_BACKEND } from "../store/blobCacheBackend";
import {
	FakeBlobStoreAdapter,
	makeEnvironment,
	withBlobCacheConfig,
	type TBlobCacheConfigOverrides,
} from "./blobCacheTestDoubles";

/**
 * Builds a policy over a working in-memory backend, or over a chosen rung of the
 * fallback chain.
 *
 * Kept out of `blobCacheTestDoubles` because that module is the low-level double
 * set (blobs, clocks, adapters) while this one wires a whole subject under test —
 * the split keeps a store-only test from importing the policy.
 */
export interface IBlobCacheHarnessOptions {
	/** `false` removes every persistent rung, leaving the memory-only path. */
	backendWorks?: boolean;
	configOverrides?: TBlobCacheConfigOverrides;
	envOverrides?: Partial<ILankaBlobCacheEnvironment>;
	/** Explicit chain, for degradation-matrix tests. */
	candidates?: readonly IBlobCacheBackendCandidate[];
}

export const makeBlobCachePolicy = (options: IBlobCacheHarnessOptions = {}) => {
	const env = makeEnvironment(options.envOverrides ?? {});
	const config = withBlobCacheConfig(options.configOverrides);
	const adapter = new FakeBlobStoreAdapter();

	const candidates =
		options.candidates ??
		(options.backendWorks === false
			? []
			: [
					{
						backend: BLOB_CACHE_BACKEND.INDEXED_DB,
						build: () => adapter,
					},
				]);

	const store = new LankaBlobCacheStore(env, config, candidates);
	const policy = new LankaBlobCachePolicy(env, config, store);

	return {
		policy,
		store,
		adapter,
		env,
		config,
	};
};
