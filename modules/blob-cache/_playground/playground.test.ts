import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installLankaCacheStoragePolyfill } from "@lankajs/storage";
import { createPlaygroundNetwork, startPlaygroundGallery } from "./app";

/**
 * The package, used as an avatar list uses it.
 *
 * What matters is the SEQUENCE a screen actually performs: ask for a source
 * before painting, warm it after, and find it warm on the next render. No unit
 * holds that sequence, and it is the sequence that produces the flash of a
 * missing avatar when it breaks.
 */
type TGallery = ReturnType<typeof startPlaygroundGallery>;

let gallery: TGallery | null = null;

const AVATAR = "https://cdn.invalid/avatars/9f1c-2b7e.png";

beforeEach(() => {
	installLankaCacheStoragePolyfill();
});

afterEach(async () => {
	gallery?.detachLifecycle();
	await gallery?.policy.clear();
	gallery = null;
	vi.restoreAllMocks();
});

const networkWith = (url: string) => {
	const network = createPlaygroundNetwork();
	network.answers.set(url, new Blob(["bytes"], { type: "image/png" }));
	return network;
};

describe("the blob-cache playground", () => {
	it("serves the network URL before anything is warmed", () => {
		// Never `undefined` for a real source: a screen must always have something
		// to paint, and the gain of a cache is the absence of a swap, not a hole.
		gallery = startPlaygroundGallery(networkWith(AVATAR));

		expect(gallery.initialSrc(AVATAR)).toBe(AVATAR);
	});

	it("reports which backend it settled on", async () => {
		gallery = startPlaygroundGallery(networkWith(AVATAR));

		await gallery.policy.hydrate();

		expect(gallery.policy.getBackend()).toBeTruthy();
	});

	it("fetches an avatar the first time it is warmed", async () => {
		const network = networkWith(AVATAR);
		gallery = startPlaygroundGallery(network);
		await gallery.policy.hydrate();

		gallery.warm(AVATAR);
		await vi.waitFor(() => expect(network.fetched).toContain(AVATAR));

		expect(network.fetched).toHaveLength(1);
	});

	it("never fetches a CORS-blocked origin, however often it is asked", async () => {
		// A host whose bytes cannot be read will never be cacheable, and trying
		// anyway costs one request per render for the life of the screen.
		const blocked = "https://blocked.invalid/avatar.png";
		const network = networkWith(blocked);
		gallery = startPlaygroundGallery(network);
		await gallery.policy.hydrate();

		gallery.warm(blocked);
		gallery.warm(blocked);
		await Promise.resolve();

		expect(network.fetched).not.toContain(blocked);
	});

	it("ignores an empty source instead of fetching one", () => {
		const network = networkWith(AVATAR);
		gallery = startPlaygroundGallery(network);

		gallery.warm("");

		expect(network.fetched).toEqual([]);
	});

	it("clears everything when the application says the session ended", async () => {
		// Privacy, not housekeeping: on a shared device the next sign-in must not
		// inherit the previous person's faces, and a thirty-day expiry is not an
		// answer to that.
		const network = networkWith(AVATAR);
		gallery = startPlaygroundGallery(network);
		await gallery.policy.hydrate();

		// Held in a box: TypeScript narrows a `let` assigned only inside a callback
		// to `never` at the call site.
		const session: { end: (() => void) | null } = { end: null };
		gallery.attachLifecycle((handler) => {
			session.end = handler;
			return () => undefined;
		});

		gallery.warm(AVATAR);
		await vi.waitFor(() => expect(network.fetched).toContain(AVATAR));

		session.end?.();

		// Back to the network URL: the bytes are gone, so there is nothing local to
		// serve, and the screen falls back to fetching them again.
		await vi.waitFor(() => expect(gallery?.initialSrc(AVATAR)).toBe(AVATAR));
	});

	it("does not guess what ends a session", () => {
		// The package has no opinion, and a default here would be a guess at the
		// host application's own event.
		const network = networkWith(AVATAR);
		gallery = startPlaygroundGallery(network);

		expect(() => {
			gallery?.attachLifecycle(() => () => undefined);
		}).not.toThrow();
	});

	it("releases object URLs when the page goes away", async () => {
		const network = networkWith(AVATAR);
		gallery = startPlaygroundGallery(network);
		await gallery.policy.hydrate();
		gallery.attachLifecycle(() => () => undefined);

		gallery.warm(AVATAR);
		await vi.waitFor(() => expect(network.fetched).toContain(AVATAR));

		window.dispatchEvent(new Event("pagehide"));

		// The stored bytes stay; only the live URLs are handed back, and the next
		// resolve creates them again.
		expect(gallery.env.urls).toEqual([]);
	});
});
