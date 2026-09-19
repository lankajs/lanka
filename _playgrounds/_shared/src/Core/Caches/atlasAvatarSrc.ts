import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

/**
 * What an avatar's `src` should be on the FIRST frame, and forever after.
 *
 * `getInitialSrc` is synchronous and final for a URL, and both halves of that
 * are the product. Synchronous, because if the blob is in memory an object URL
 * can be minted on the spot and the first render already has it. Final, because
 * swapping `src` on a mounted image makes the browser discard the decoded frame
 * and decode again — which a person sees as a flicker.
 *
 * A `null` answer is not a failure: it is the cache saying the bytes are not in
 * memory, and the network is the fallback it was designed to leave in place.
 *
 * ## Why this is not inlined in each component
 *
 * It was, in Vue's, and the branch could not be measured: a `??` inside a
 * single-file component's setup compiles into something v8 reports as one arm
 * never taken, however many scenes render it. The same is true of Svelte's and
 * Solid's compiled output. A plain function is measured properly, is testable
 * without a renderer, and — the real reason — means five components cannot
 * disagree about what "already cached" means.
 */
export const atlasAvatarSrc = (cache: LankaBlobCachePolicy, url: string): string =>
	cache.getInitialSrc(url) ?? url;
