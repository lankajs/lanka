import { cleanup, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAtlasAvatarCache } from "@lanka-playgrounds/_shared";
import AtlasAvatar from "./AtlasAvatar.vue";

/**
 * The face, and the two promises it makes about when it changes.
 *
 * Tested HERE rather than in an application, because the component belongs to
 * the ecosystem: the SPA and the Nuxt host both render it, and a scene that
 * lived in one of them would leave the other one's copy unproven.
 */
afterEach(() => {
	cleanup();
});

/**
 * The cache with every rung of its fallback chain forced off.
 *
 * `indexedDb` and `caches` are `undefined` because this asserts the COMPONENT
 * rather than IndexedDB, and `createObjectUrl` is stubbed because jsdom has none
 * — which is the same reason the real one is allowed to answer `null`.
 */
const avatars = (over: Record<string, unknown> = {}) =>
	createAtlasAvatarCache({
		indexedDb: undefined,
		caches: undefined,
		now: () => 0,
		createObjectUrl: () => "blob:atlas",
		revokeObjectUrl: () => undefined,
		...over,
	});

describe("AtlasAvatar", () => {
	it("falls back to the URL itself when the cache has nothing", () => {
		render(AtlasAvatar, {
			props: { cache: avatars(), url: "/api/crew/c-1/avatar.png", name: "Ada" },
		});

		// `getInitialSrc` answering `null` is not a failure: it is the cache saying
		// the bytes are not in memory, and the network is the fallback it was
		// designed to leave in place.
		expect(screen.getByAltText<HTMLImageElement>("Ada").getAttribute("src")).toBe(
			"/api/crew/c-1/avatar.png",
		);
	});

	it("asks the cache to warm for the NEXT mount", () => {
		// The whole design in one assertion: this render is not improved, the next
		// one is. A component that swapped `src` when the bytes arrived would make
		// the browser discard a decoded frame and decode again, which a person sees
		// as a flicker.
		const cache = avatars();
		const warm = vi.spyOn(cache, "warmCache");

		render(AtlasAvatar, {
			props: { cache, url: "/api/crew/c-2/avatar.png", name: "Grace" },
		});

		expect(warm).toHaveBeenCalledWith("/api/crew/c-2/avatar.png");
	});

	it("uses what the cache already holds, on the first frame", () => {
		// Synchronous and final: if the blob is in memory an object URL is minted on
		// the spot, so the first render already has it and no second one is needed.
		const cache = avatars();

		vi.spyOn(cache, "getInitialSrc").mockReturnValue("blob:atlas");

		render(AtlasAvatar, {
			props: { cache, url: "/api/crew/c-3/avatar.png", name: "Katherine" },
		});

		expect(screen.getByAltText<HTMLImageElement>("Katherine").getAttribute("src")).toBe(
			"blob:atlas",
		);
	});
});
