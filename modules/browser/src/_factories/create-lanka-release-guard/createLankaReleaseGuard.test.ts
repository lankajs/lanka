import { describe, expect, it, vi } from "vitest";
import { createLankaReleaseGuard } from "./createLankaReleaseGuard";
import type { ILankaReleaseMemory } from "../../_interfaces/ILankaReleaseMemory";

const memoryHolding = (initial: string | null): ILankaReleaseMemory => {
	let held = initial;
	return {
		read: () => held,
		write: (version) => {
			held = version;
		},
	};
};

describe("noticing a new build", () => {
	it("drops the caches the first time it sees a version", () => {
		const dropCaches = vi.fn(() => Promise.resolve());
		const guard = createLankaReleaseGuard({
			readVersion: () => "2.0.0",
			memory: memoryHolding(null),
			dropCaches,
		});

		return guard.check().then((outcome) => {
			// A first run is where an upgrade from a build that predates this guard
			// lands, and its caches are exactly the stale ones. A visitor whose
			// first run this really is has nothing to drop, so it costs them nothing.
			expect(outcome).toBe("released");
			expect(dropCaches).toHaveBeenCalledTimes(1);
		});
	});

	it("drops nothing on a second start of the same build", async () => {
		const dropCaches = vi.fn(() => Promise.resolve());
		const memory = memoryHolding(null);
		const guard = createLankaReleaseGuard({
			readVersion: () => "2.0.0",
			memory,
			dropCaches,
		});

		await guard.check();
		const outcome = await guard.check();

		// The assertion that matters more than the first one: a guard that clears
		// on every start is a slow first screen on every visit.
		expect(outcome).toBe("unchanged");
		expect(dropCaches).toHaveBeenCalledTimes(1);
	});

	it("drops again when the version moves on", async () => {
		const dropCaches = vi.fn(() => Promise.resolve());
		const memory = memoryHolding("2.0.0");
		let version = "2.0.0";
		const guard = createLankaReleaseGuard({
			readVersion: () => version,
			memory,
			dropCaches,
		});

		await guard.check();
		version = "2.1.0";
		const outcome = await guard.check();

		expect(outcome).toBe("released");
		expect(dropCaches).toHaveBeenCalledTimes(1);
	});

	it("waits for a version that arrives over the wire", async () => {
		const guard = createLankaReleaseGuard({
			readVersion: () => Promise.resolve("3.0.0"),
			memory: memoryHolding("3.0.0"),
			dropCaches: () => Promise.resolve(),
		});

		expect(await guard.check()).toBe("unchanged");
	});

	it("treats an unreadable version as no news, not as a release", async () => {
		const dropCaches = vi.fn(() => Promise.resolve());
		const guard = createLankaReleaseGuard({
			readVersion: () => null,
			memory: memoryHolding("2.0.0"),
			dropCaches,
		});

		// Otherwise a failing request for the manifest would empty the caches on
		// every start, which is the opposite of what the guard is for.
		expect(await guard.check()).toBe("unknown");
		expect(dropCaches).not.toHaveBeenCalled();
	});

	it("survives a version it could not fetch, and says so", async () => {
		const report = vi.fn();
		const guard = createLankaReleaseGuard({
			readVersion: () => Promise.reject(new Error("offline")),
			memory: memoryHolding(null),
			dropCaches: () => Promise.resolve(),
			report,
		});

		// Contained, not silent: the ancestor swallowed this and nobody ever
		// learned the guard had stopped working.
		expect(await guard.check()).toBe("unknown");
		expect(report).toHaveBeenCalledWith(expect.stringContaining("offline"));
	});

	it("survives caches it is not allowed to touch", async () => {
		const report = vi.fn();
		const guard = createLankaReleaseGuard({
			readVersion: () => "2.0.0",
			memory: memoryHolding(null),
			dropCaches: () => Promise.reject(new Error("denied")),
			report,
		});

		expect(await guard.check()).toBe("unknown");
		expect(report).toHaveBeenCalledWith(expect.stringContaining("denied"));
	});

	it("remembers the version only after the caches actually went", async () => {
		const memory = memoryHolding(null);
		const guard = createLankaReleaseGuard({
			readVersion: () => "2.0.0",
			memory,
			dropCaches: () => Promise.reject(new Error("denied")),
		});

		await guard.check();

		// Writing first would leave a visitor with the old caches and a note saying
		// they are new — the one state this guard can never recover from.
		expect(memory.read()).toBe(null);
	});
});
