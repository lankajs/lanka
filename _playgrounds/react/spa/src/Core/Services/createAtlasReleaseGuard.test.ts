import { describe, expect, it, vi } from "vitest";
import { createAtlasReleaseGuard } from "./createAtlasReleaseGuard";

/** A memory of its own, so the test never depends on what `localStorage` holds. */
const memory = () => {
	let stored: string | null = null;

	return {
		read: () => stored,
		write: (version: string) => {
			stored = version;
		},
	};
};

const answering = (version: unknown): typeof fetch =>
	vi.fn(() =>
		Promise.resolve({ json: () => Promise.resolve({ version }) }),
	) as unknown as typeof fetch;

describe("createAtlasReleaseGuard", () => {
	it("says a build is new the first time it sees it, and drops the caches", async () => {
		vi.stubGlobal("fetch", answering("2026.09.13-1"));
		const dropCaches = vi.fn(() => Promise.resolve());

		const outcome = await createAtlasReleaseGuard("https://atlas.test/api", {
			memory: memory(),
			dropCaches,
		}).check();

		expect(outcome).toBe("released");
		expect(dropCaches).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});

	it("says nothing changed the second time, and drops nothing", async () => {
		vi.stubGlobal("fetch", answering("2026.09.13-1"));
		const dropCaches = vi.fn(() => Promise.resolve());
		const guard = createAtlasReleaseGuard("https://atlas.test/api", {
			memory: memory(),
			dropCaches,
		});

		await guard.check();
		const outcome = await guard.check();

		expect(outcome).toBe("unchanged");
		expect(dropCaches).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});

	it("treats an unreadable version as UNKNOWN, and keeps the caches", async () => {
		// Not knowing is not a release. Dropping the caches whenever the version
		// cannot be read turns one failed request into an empty cache.
		vi.stubGlobal("fetch", answering(undefined));
		const dropCaches = vi.fn(() => Promise.resolve());

		const outcome = await createAtlasReleaseGuard("https://atlas.test/api", {
			memory: memory(),
			dropCaches,
		}).check();

		expect(outcome).toBe("unknown");
		expect(dropCaches).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it("never throws, whatever the network did", async () => {
		// A guard that took down start-up because it could not read a cache would
		// be worse than the problem it exists for.
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("offline"))),
		);

		await expect(
			createAtlasReleaseGuard("https://atlas.test/api", { memory: memory() }).check(),
		).resolves.toBe("unknown");
		vi.unstubAllGlobals();
	});
});
