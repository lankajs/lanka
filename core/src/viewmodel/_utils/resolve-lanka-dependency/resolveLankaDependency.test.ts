import { describe, expect, it, vi } from "vitest";
import { resolveLankaDependency } from "./resolveLankaDependency";

/**
 * One decision that used to be written six times.
 *
 * The factory form is the one that matters: a ViewModel declared at module level
 * runs its body before any framework instance exists, so resolving gateways
 * eagerly would throw at import time.
 */
describe("resolveLankaDependency", () => {
	it("returns a bag given directly", () => {
		const gateways = { user: "gateway" };

		expect(resolveLankaDependency(gateways)).toBe(gateways);
	});

	it("calls a factory and returns what it built", () => {
		const gateways = { user: "gateway" };
		const factory = vi.fn(() => gateways);

		expect(resolveLankaDependency(factory)).toBe(gateways);
		expect(factory).toHaveBeenCalledOnce();
	});

	it("does not call the factory until asked", () => {
		const factory = vi.fn(() => ({}));

		expect(factory).not.toHaveBeenCalled();
		resolveLankaDependency(factory);
		expect(factory).toHaveBeenCalledOnce();
	});

	it("calls the factory again on every read", () => {
		// No memoisation here on purpose: the locator behind it owns the caching,
		// and a second cache would answer with an object the locator has replaced.
		const factory = vi.fn(() => ({}));

		resolveLankaDependency(factory);
		resolveLankaDependency(factory);

		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("yields an empty bag when nothing was declared", () => {
		expect(resolveLankaDependency(undefined)).toEqual({});
	});

	it("passes a declared empty bag through as itself", () => {
		const declared = {};

		expect(resolveLankaDependency(declared)).toBe(declared);
	});
});
