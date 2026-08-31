import { beforeEach, describe, expect, it } from "vitest";
import { createPlaygroundConsent, startPlaygroundDeployment } from "./app";

/**
 * The package, used as a consent banner uses it.
 *
 * What a banner needs is that a written choice comes back, that a withdrawn one
 * does not, and that something unreadable is treated as no choice rather than
 * repaired — whichever cookie mechanism the browser happened to provide.
 */
beforeEach(() => {
	for (const cookie of document.cookie.split(";")) {
		const name = cookie.split("=")[0].trim();
		if (name) document.cookie = `${name}=;max-age=0;path=/`;
	}
});

describe("the browser playground", () => {
	it("reports that cookies are usable in a browser", () => {
		expect(createPlaygroundConsent().isAvailable()).toBe(true);
	});

	it("reads nothing before the visitor has chosen", async () => {
		const consent = createPlaygroundConsent();

		expect(await consent.read()).toBeNull();
		expect(await consent.hasChoice()).toBe(false);
	});

	it("remembers what the visitor accepted", async () => {
		const consent = createPlaygroundConsent();

		await consent.accept({ analytics: true, marketing: false });

		expect(await consent.read()).toEqual({ analytics: true, marketing: false });
		expect(await consent.hasChoice()).toBe(true);
	});

	it("replaces the previous choice rather than adding to it", async () => {
		const consent = createPlaygroundConsent();

		await consent.accept({ analytics: true, marketing: true });
		await consent.accept({ analytics: false, marketing: false });

		expect(await consent.read()).toEqual({ analytics: false, marketing: false });
	});

	it("forgets the choice when consent is withdrawn", async () => {
		const consent = createPlaygroundConsent();
		await consent.accept({ analytics: true, marketing: true });

		await consent.withdraw();

		expect(await consent.read()).toBeNull();
	});

	it("treats an unreadable cookie as no choice at all", async () => {
		document.cookie = "playground-consent=not-json;path=/";
		const consent = createPlaygroundConsent();

		expect(await consent.read()).toBeNull();
	});
});

describe("an application that survives its own deployments", () => {
	it("drops what the previous build left, once", async () => {
		const app = startPlaygroundDeployment();

		expect(await app.start()).toBe("released");
		expect(app.caches).toEqual([]);
	});

	it("leaves the caches alone on the next start of the same build", async () => {
		const app = startPlaygroundDeployment();
		await app.start();
		app.caches = ["avatars"];

		const outcome = await app.start();

		// The assertion the guard is really about: clearing on every start is a
		// slow first screen on every visit, which is worse than the bug it fixes.
		expect(outcome).toBe("unchanged");
		expect(app.caches).toEqual(["avatars"]);
	});

	it("notices the next deployment", async () => {
		const app = startPlaygroundDeployment();
		await app.start();
		app.caches = ["avatars"];

		app.version = "1.1.0";

		expect(await app.start()).toBe("released");
		expect(app.caches).toEqual([]);
	});

	it("keeps the caches when the build will not say what it is", async () => {
		const app = startPlaygroundDeployment();
		await app.start();
		app.caches = ["avatars"];
		app.version = null;

		expect(await app.start()).toBe("unknown");
		expect(app.caches).toEqual(["avatars"]);
	});
});
