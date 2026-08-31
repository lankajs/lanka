import { afterEach, describe, expect, it, vi } from "vitest";
import { setupLankaBlobCacheLifecycle } from "./setupLankaBlobCacheLifecycle";

const clear = vi.fn(() => Promise.resolve());
const releaseObjectUrls = vi.fn();
const cache = { clear, releaseObjectUrls };

/** The application's end-of-session subscription, doubled here. */
const unsubscribeSession = vi.fn();
let sessionHandler: (() => void) | null = null;
const subscribeToSessionEnd = vi.fn((handler: () => void) => {
	sessionHandler = handler;
	return unsubscribeSession;
});

/** Each test tears down so listeners do not leak into the next. */
let teardown: (() => void) | null = null;

const setup = (withSession = true): void => {
	teardown = setupLankaBlobCacheLifecycle({
		cache,
		subscribeToSessionEnd: withSession ? subscribeToSessionEnd : undefined,
	});
};

describe("setupLankaBlobCacheLifecycle", () => {
	afterEach(() => {
		teardown?.();
		teardown = null;
		sessionHandler = null;
		vi.clearAllMocks();
	});

	/**
	 * Privacy, not housekeeping: on a shared device the next sign-in must not
	 * inherit someone else's images, and a thirty-day expiry does not achieve that.
	 */
	it("clears the cache at the end of a session", () => {
		setup();

		sessionHandler?.();

		expect(clear).toHaveBeenCalledTimes(1);
	});

	it("subscribes exactly once", () => {
		setup();

		expect(subscribeToSessionEnd).toHaveBeenCalledTimes(1);
	});

	it("works without a subscription and cleans nothing", () => {
		// The package has no opinion on what ends a session; a default here would
		// be a guess at the host application's event.
		setup(false);

		window.dispatchEvent(new Event("pagehide"));

		expect(releaseObjectUrls).toHaveBeenCalledTimes(1);
		expect(clear).not.toHaveBeenCalled();
	});

	it("releases object URLs when the page goes away", () => {
		setup();

		window.dispatchEvent(new Event("pagehide"));

		// Every live object-URL pins its blob. The stored bytes stay, and the next
		// resolve creates the URL again.
		expect(releaseObjectUrls).toHaveBeenCalledTimes(1);
	});

	it("listens to nothing after teardown", () => {
		setup();
		teardown?.();
		teardown = null;

		window.dispatchEvent(new Event("pagehide"));

		expect(unsubscribeSession).toHaveBeenCalledTimes(1);
		expect(releaseObjectUrls).not.toHaveBeenCalled();
	});
});
