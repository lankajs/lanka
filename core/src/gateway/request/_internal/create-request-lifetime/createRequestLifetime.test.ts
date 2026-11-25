import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequestLifetime } from "./createRequestLifetime";

/**
 * One attempt's lifetime, against a page that hides.
 *
 * A mobile WebView is frozen when the user leaves it, and timers do not run
 * while it is: an overdue `setTimeout` fires at once on resume. Fake timers play
 * the freeze — the clock moves, the page reports `hidden`, nothing in between.
 */

let visibility: DocumentVisibilityState = "visible";

const setVisibility = (state: DocumentVisibilityState): void => {
	visibility = state;
	document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => {
	visibility = "visible";
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		get: () => visibility,
	});
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	Reflect.deleteProperty(document, "visibilityState");
});

describe("the deadline counts only time the page is visible (#16)", () => {
	it("on a visible page it fires at `timeoutMs`, as a timeout", () => {
		const lifetime = createRequestLifetime(undefined, 10_000);

		vi.advanceTimersByTime(9_999);
		expect(lifetime.signal?.aborted).toBe(false);
		vi.advanceTimersByTime(1);

		expect(lifetime.signal?.aborted).toBe(true);
		expect(lifetime.timedOut()).toBe(true);
		expect((lifetime.signal?.reason as DOMException).name).toBe("TimeoutError");
		lifetime.dispose();
	});

	it("a minute frozen in the background is not counted: the rest runs on return", () => {
		const lifetime = createRequestLifetime(undefined, 10_000);

		vi.advanceTimersByTime(4_000);
		setVisibility("hidden");
		vi.advanceTimersByTime(60_000);
		expect(lifetime.signal?.aborted).toBe(false);

		setVisibility("visible");
		vi.advanceTimersByTime(5_999);
		expect(lifetime.signal?.aborted).toBe(false);
		vi.advanceTimersByTime(1);
		expect(lifetime.timedOut()).toBe(true);
		lifetime.dispose();
	});

	it("an attempt started on a hidden page starts its clock when the page shows", () => {
		visibility = "hidden";
		const lifetime = createRequestLifetime(undefined, 1_000);

		vi.advanceTimersByTime(60_000);
		expect(lifetime.signal?.aborted).toBe(false);
		setVisibility("visible");
		vi.advanceTimersByTime(1_000);

		expect(lifetime.timedOut()).toBe(true);
		lifetime.dispose();
	});

	it('`"prerender"` is not hidden: a test runner\'s DOM must still see its timeouts', () => {
		visibility = "prerender" as DocumentVisibilityState;
		const lifetime = createRequestLifetime(undefined, 1_000);

		vi.advanceTimersByTime(1_000);

		expect(lifetime.timedOut()).toBe(true);
		lifetime.dispose();
	});

	it("`pagehide` pauses the deadline too", () => {
		const lifetime = createRequestLifetime(undefined, 1_000);

		window.dispatchEvent(new Event("pagehide"));
		vi.advanceTimersByTime(60_000);

		expect(lifetime.signal?.aborted).toBe(false);
		lifetime.dispose();
	});

	it("does not fire after `dispose`", () => {
		const lifetime = createRequestLifetime(undefined, 1_000);

		setVisibility("hidden");
		lifetime.dispose();
		setVisibility("visible");
		vi.advanceTimersByTime(60_000);

		expect(lifetime.signal?.aborted).toBe(false);
	});
});

describe("the attempt knows whether the page hid (#16)", () => {
	it("not when the page stayed visible", () => {
		const lifetime = createRequestLifetime(undefined, 1_000);

		expect(lifetime.wasHidden()).toBe(false);
		lifetime.dispose();
	});

	it("when it hid at any moment, even if it is visible again", () => {
		const lifetime = createRequestLifetime(undefined, 1_000);

		setVisibility("hidden");
		setVisibility("visible");

		expect(lifetime.wasHidden()).toBe(true);
		lifetime.dispose();
	});

	it("when the page is unloading under it", () => {
		const lifetime = createRequestLifetime(undefined, undefined);

		window.dispatchEvent(new Event("pagehide"));

		expect(lifetime.wasHidden()).toBe(true);
		lifetime.dispose();
	});

	it("with no signal and no deadline, it still follows the page and produces no signal", () => {
		// "No options" and "empty options" are different statements to a
		// transport: following the page must not invent a signal.
		const lifetime = createRequestLifetime(undefined, undefined);

		setVisibility("hidden");

		expect(lifetime.signal).toBeUndefined();
		expect(lifetime.wasHidden()).toBe(true);
		lifetime.dispose();
	});

	it("stops following the page on `dispose`", () => {
		const lifetime = createRequestLifetime(undefined, 1_000);

		lifetime.dispose();
		setVisibility("hidden");

		expect(lifetime.wasHidden()).toBe(false);
	});
});

describe("the caller's signal", () => {
	it("still cancels, and a cancellation is not a timeout", () => {
		const caller = new AbortController();
		const lifetime = createRequestLifetime(caller.signal, 10_000);

		caller.abort();

		expect(lifetime.signal?.aborted).toBe(true);
		expect(lifetime.timedOut()).toBe(false);
		lifetime.dispose();
	});

	it("already aborted, aborts the attempt at once", () => {
		const caller = new AbortController();
		caller.abort();

		expect(createRequestLifetime(caller.signal, undefined).signal?.aborted).toBe(true);
	});
});
