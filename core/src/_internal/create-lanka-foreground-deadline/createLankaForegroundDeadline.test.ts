import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLankaForegroundDeadline } from "./createLankaForegroundDeadline";

/**
 * The clock three places share: the request lifetime, start-up services and
 * `@lankajs/optimistic`'s lock. Fake timers play a frozen WebView — the clock
 * moves while the page reports `hidden`, and nothing runs in between.
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

describe("createLankaForegroundDeadline", () => {
	it("runs out at `timeoutMs` on a page that stays visible", () => {
		const onExpire = vi.fn();
		const deadline = createLankaForegroundDeadline(1_000, onExpire);

		vi.advanceTimersByTime(999);
		expect(onExpire).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);

		expect(onExpire).toHaveBeenCalledTimes(1);
		expect(deadline.expired()).toBe(true);
		expect(deadline.wasHidden()).toBe(false);
		deadline.clear();
	});

	it("stops for a hide seen while it runs, and goes on with what was left", () => {
		const onExpire = vi.fn();
		const deadline = createLankaForegroundDeadline(1_000, onExpire);

		vi.advanceTimersByTime(400);
		setVisibility("hidden");
		vi.advanceTimersByTime(60_000);
		expect(onExpire).not.toHaveBeenCalled();
		setVisibility("visible");
		vi.advanceTimersByTime(599);
		expect(onExpire).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);

		expect(onExpire).toHaveBeenCalledTimes(1);
		expect(deadline.wasHidden()).toBe(true);
		deadline.clear();
	});

	it("runs on a page hidden from the start: it may never say `visible`", () => {
		visibility = "hidden";
		const onExpire = vi.fn();
		const deadline = createLankaForegroundDeadline(1_000, onExpire);

		vi.advanceTimersByTime(1_000);

		expect(onExpire).toHaveBeenCalledTimes(1);
		expect(deadline.wasHidden()).toBe(false);
		deadline.clear();
	});

	it("with no `timeoutMs`, only follows the page", () => {
		const onExpire = vi.fn();
		const deadline = createLankaForegroundDeadline(undefined, onExpire);

		window.dispatchEvent(new Event("pagehide"));
		vi.advanceTimersByTime(60_000);

		expect(deadline.wasHidden()).toBe(true);
		expect(onExpire).not.toHaveBeenCalled();
		deadline.clear();
	});

	it("`clear` stops both the clock and the page watch, and may be called twice", () => {
		const onExpire = vi.fn();
		const deadline = createLankaForegroundDeadline(1_000, onExpire);

		deadline.clear();
		deadline.clear();
		setVisibility("hidden");
		setVisibility("visible");
		vi.advanceTimersByTime(60_000);

		expect(onExpire).not.toHaveBeenCalled();
		expect(deadline.wasHidden()).toBe(false);
	});
});
