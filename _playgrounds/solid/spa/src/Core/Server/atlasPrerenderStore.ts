import { LankaStorage } from "@lankajs/storage";
import { createLankaUnstorageAdapter } from "@lankajs/unstorage";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * What a BUILD keeps, behind the storage port every screen already reads.
 *
 * Three of the four adapters in that family are browser rungs — IndexedDB,
 * Cache Storage, `localStorage` — so on a server the port has exactly one
 * implementation, and this is it. That makes this file the only place in the
 * ecosystem where `@lankajs/unstorage` can be shown doing the thing it exists
 * for, and it is shown in the one situation where remembering an answer between
 * calls is not a bug.
 *
 * ## Why the PRERENDER may remember and the request may not
 *
 * Persistence is only safe where there is nobody to get wrong. A prerender is
 * that case by construction: `runLankaStatic` takes no headers, so no session,
 * no cookie and no identity ever entered the scope that produced the answer —
 * there is no "whose" attached to it.
 *
 * `readAtlasMissions` is the opposite and must never arrive here. It runs inside
 * a scope carrying a caller's `cookie`, and a cache in front of it would hand
 * the first visitor's board to the second — a data leak with no error, no log
 * and no way to notice until somebody reads a board that is not theirs. The two
 * paths are separate names so that this file has exactly one importer, and a
 * scene next door reads the source of the other one to keep it that way.
 *
 * ## `memoryDriver`, and what a deployment would put here instead
 *
 * A build is one process and this cache should die with it, so memory is the
 * honest driver rather than the lazy one. unstorage mounts a filesystem, Redis,
 * Cloudflare KV and twenty other things behind the same call, so a build that
 * spread across machines changes this one line — which is the entire argument
 * for the port being a port rather than an interface nobody swaps.
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
 * The port stores STRINGS and gives them back byte for byte, so the encoding is
 * this application's decision rather than the adapter's. unstorage's own
 * `getItem` would parse on the way out — a stored `"null"` returning as `null` —
 * which is why the adapter reads raw underneath and why the JSON here is
 * spelled out.
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
