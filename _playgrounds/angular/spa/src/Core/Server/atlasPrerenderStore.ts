import { LankaStorage } from "@lankajs/storage";
import { createLankaUnstorageAdapter } from "@lankajs/unstorage";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * What a BUILD keeps between the routes it is rendering.
 *
 * Every other member of the storage family wants a browser — web storage,
 * IndexedDB, Cache Storage — so `@lankajs/unstorage` is the only one a server
 * can mount, and therefore the only way anything done inside
 * `@lankajs/host/server` survives past the call that did it. This application
 * renders to a string on a server; this is where that adapter earns its place
 * in the manifest.
 *
 * ## Why the PRERENDER path and no other
 *
 * A prerender has no caller. `runLankaStatic` takes no headers, precisely so a
 * build cannot bake one person's session into a page that is then served to
 * everybody — and that refusal is what makes the answer shareable between
 * calls, because there is no "whose" left to get wrong.
 *
 * The request path must never see this. `readAtlasMissions` and the render
 * around it run inside a scope carrying a cookie, so a store that remembered
 * its answer there would hand the first visitor's board to the second. The two
 * paths are separate functions for that reason, and only one of them can reach
 * this module.
 *
 * ## A memory driver, and what a deployment would swap in
 *
 * `memoryDriver` because a build is one process and the cache should die with
 * it. The same port fronts a filesystem, a Redis or a Cloudflare KV, so a
 * deployment that prerenders across machines edits this line and nothing above
 * it — which is the argument for the port being a port.
 */
const engine = createStorage({ driver: memoryDriver() });

export const atlasPrerenderStore = new LankaStorage({
	local: createLankaUnstorageAdapter(engine),
});

/** The single key this store holds, named once so a reader and a writer cannot disagree. */
export const ATLAS_PRERENDER_KEY = "atlas:prerender:missions";

/**
 * What the store holds for that key, or nothing.
 *
 * The port stores STRINGS and gives them back byte for byte, which is why the
 * JSON here is written out rather than left to the adapter. unstorage's own
 * `getItem` deserialises — a stored `"null"` returns as `null`, and a mission
 * titled `"null"` would come back as no mission at all — so the adapter reads
 * with `getItemRaw` underneath and the encoding stays this application's
 * decision.
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
