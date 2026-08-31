import { describe, expect, it } from "vitest";
import { lankaRouterChunkSource } from "./lankaRouterChunkSource";

/**
 * The binding between a route manifest and the sweeper.
 *
 * What it must not do is as important as what it must: it never calls a route's
 * loader, and it never invents an order the manifest did not state.
 */
const manifest = () => [
	{ path: "/orders", load: () => Promise.resolve("orders"), priority: 2 },
	{ path: "/profile", load: () => Promise.resolve("profile") },
	{ path: "/admin", load: () => Promise.resolve("admin") },
];

describe("a route manifest as a chunk source", () => {
	it("keeps the path as the chunk's identity", () => {
		expect(lankaRouterChunkSource(manifest)().map((e) => e.path)).toEqual([
			"/orders",
			"/profile",
			"/admin",
		]);
	});

	it("gives an entry that named no weight the default one", () => {
		const source = lankaRouterChunkSource(manifest, { defaultPriority: 5 });

		expect(source().map((e) => e.priority)).toEqual([2, 5, 5]);
	});

	it("drops what the application excluded", () => {
		const source = lankaRouterChunkSource(manifest, { exclude: ["/admin"] });

		// Warming a chunk behind a permission most visitors lack is bandwidth
		// spent on nobody's behalf.
		expect(source().map((e) => e.path)).toEqual(["/orders", "/profile"]);
	});

	it("does not load anything while building the source", async () => {
		let loaded = 0;
		const source = lankaRouterChunkSource(() => [
			{
				path: "/orders",
				load: () => {
					loaded += 1;
					return Promise.resolve(null);
				},
			},
		]);

		const entries = source();

		// Building the list is not sweeping it: the sweeper decides WHEN, and it
		// waits for a quiet wire to do it.
		expect(loaded).toBe(0);
		await entries[0].preload();
		expect(loaded).toBe(1);
	});

	it("reads the routes again on every sweep", () => {
		let routes = [{ path: "/one", load: () => Promise.resolve(null) }];
		const source = lankaRouterChunkSource(() => routes);

		routes = [...routes, { path: "/two", load: () => Promise.resolve(null) }];

		// A function rather than a list, because routes appear later than the
		// service that sweeps them — a lazily registered route would be invisible.
		expect(source()).toHaveLength(2);
	});
});
