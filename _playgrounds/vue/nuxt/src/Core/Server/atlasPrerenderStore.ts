import { LankaStorage } from "@lankajs/storage";
import { createLankaUnstorageAdapter } from "@lankajs/unstorage";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * Where a BUILD keeps what it has already fetched.
 *
 * `@lankajs/unstorage` is the only member of its family that runs on a server —
 * the other three are native modules — so it is the only way work done inside
 * `@lankajs/host/server` persists anything at all. This is that use, in the one
 * place where persistence across calls is safe.
 *
 * ## Why only the PRERENDER path may use it
 *
 * A prerender has no caller by definition: `runLankaStatic` refuses headers
 * exactly so a build cannot bake one user's session into a page every user is
 * then served. That is what makes its result shareable between calls — there is
 * no "whose" to get wrong.
 *
 * The request path must never touch this. `readAtlasMissions` runs inside a
 * scope carrying a cookie, and a store that remembered its answer would serve
 * the first visitor's board to the second. The two paths are separate names for
 * that reason, and this store is reachable from only one of them.
 *
 * ## A memory driver, and what a real deployment would put here
 *
 * `memoryDriver` because a build is one process and the cache dies with it.
 * unstorage mounts a filesystem, a Redis, a Cloudflare KV or twenty other
 * things behind the same port, so a deployment that prerenders across machines
 * changes this line and nothing else — which is the whole argument for the port
 * being a port.
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
 * this application's decision rather than the adapter's. unstorage's own
 * `getItem` would deserialise — a stored `"null"` coming back as `null` — which
 * is why the adapter uses `getItemRaw` underneath and why the JSON here is
 * explicit.
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
