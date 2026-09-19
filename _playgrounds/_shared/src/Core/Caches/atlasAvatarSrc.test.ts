import { describe, expect, it } from "vitest";
import { atlasAvatarSrc } from "./atlasAvatarSrc";
import { atlasAvatarUrl } from "./atlasAvatarUrl";
import { createAtlasAvatarCache } from "./createAtlasAvatarCache";

/**
 * The two arms every ecosystem's avatar takes, measured once.
 *
 * Here rather than inside five components, because inside one it cannot be
 * measured at all: a `??` in a single-file component's setup compiles into
 * something v8 reports as one arm never taken, however many scenes render it.
 */
const avatars = () =>
	createAtlasAvatarCache({
		indexedDb: undefined,
		caches: undefined,
		now: () => 0,
		createObjectUrl: () => "blob:atlas",
		revokeObjectUrl: () => undefined,
	});

describe("atlasAvatarSrc", () => {
	it("falls back to the URL when the cache holds nothing yet", () => {
		// Not a failure: the cache is saying the bytes are not in memory, and the
		// network is the fallback it was designed to leave in place.
		const url = atlasAvatarUrl("c-1");

		expect(atlasAvatarSrc(avatars(), url)).toBe(url);
	});

	it("answers the cached object URL on the FIRST frame", () => {
		const cache = avatars();
		const url = atlasAvatarUrl("c-2");

		// Standing in for a warmed cache: what matters is that a hit is answered
		// synchronously, so the first render already has it and no second one is
		// needed to improve the picture.
		cache.getInitialSrc = () => "blob:atlas";

		expect(atlasAvatarSrc(cache, url)).toBe("blob:atlas");
	});
});

describe("atlasAvatarUrl", () => {
	it("derives the address from the crew id", () => {
		// A rule and not a payload field: the server derives the bytes from the id
		// and promises they never change, which is what lets the cache hold them
		// without ever asking again.
		expect(atlasAvatarUrl("c-9")).toBe("/api/crew/c-9/avatar.png");
	});
});
