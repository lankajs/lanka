import { LankaStorage } from "@lankajs/storage";
import { createLankaUnstorageAdapter } from "@lankajs/unstorage";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * What a BUILD keeps between the routes it prerenders.
 *
 * Three of the four storage adapters are native modules — `localStorage`, the
 * Cache API, IndexedDB — and a Kit server has none of them. `@lankajs/unstorage`
 * is the one that runs where `@lankajs/host/server` runs, which makes it the
 * only way anything this host does outlives a single call. This is that use, in
 * the one place on this host where outliving a call is safe.
 *
 * ## Why the PRERENDER path and no other
 *
 * A prerender has no caller: `runLankaStatic` takes no headers, precisely so a
 * build cannot bake one user's session into a page every user is then served.
 * No caller means no "whose" to get wrong, and that is what makes one call's
 * answer fit to hand to the next.
 *
 * The request path must never reach this. `readAtlasMissions` runs inside a
 * scope carrying the caller's cookie, and a store that remembered its answer
 * would serve the first visitor's board to the second — silently, and correctly
 * for exactly one person. The two paths are separate names for that reason, and
 * only one of them can see this module.
 *
 * ## A memory driver, and what a deployment would put here instead
 *
 * `memoryDriver` because `vite build` is one process and the cache should die
 * with it. unstorage mounts a filesystem, a Redis, a Cloudflare KV and twenty
 * other engines behind the same port, so a deployment that prerenders across
 * machines changes this one line — which is the entire argument for the port
 * being a port rather than a wrapper around whichever engine came first.
 */
const engine = createStorage({ driver: memoryDriver() });

export const atlasPrerenderStore = new LankaStorage({
	local: createLankaUnstorageAdapter(engine),
});

/** The one key this store holds, named once so a reader and a writer cannot disagree. */
export const ATLAS_PRERENDER_KEY = "atlas:prerender:missions";

/**
 * What the store holds for that key, or nothing.
 *
 * The port stores STRINGS and returns them byte for byte, so the encoding is
 * this application's decision rather than the adapter's — which is why the JSON
 * is written out here instead of being someone else's default. unstorage's own
 * `getItem` deserialises, and a stored `"null"` would come back as `null`; the
 * adapter reads with `getItemRaw` underneath so that it cannot.
 */
export const readPrerenderedMissions = async (): Promise<IAtlasMission[] | null> => {
	const held = await atlasPrerenderStore.getLocal(ATLAS_PRERENDER_KEY);

	return held === null ? null : (JSON.parse(held) as IAtlasMission[]);
};

/** Keeps a build's answer for the rest of that build. */
export const keepPrerenderedMissions = async (
	missions: readonly IAtlasMission[],
): Promise<void> => {
	await atlasPrerenderStore.setLocal(ATLAS_PRERENDER_KEY, JSON.stringify(missions));
};
