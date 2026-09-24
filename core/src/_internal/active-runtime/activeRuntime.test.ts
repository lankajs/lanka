import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getActiveRuntime,
	requireActiveRuntime,
	setActiveLankaRuntime,
	setLankaRuntimeResolver,
} from "./activeRuntime";
import type { ILankaRuntime } from "./activeRuntime";

/** Enough of a runtime to be told apart from another one. */
const runtime = (name: string) => ({ name, getFlags: () => ({}) }) as unknown as ILankaRuntime;

describe("which instance is active", () => {
	afterEach(() => {
		setLankaRuntimeResolver(null);
		setActiveLankaRuntime(null);
	});

	it("is the module pointer when nothing else answers", () => {
		const one = runtime("one");
		setActiveLankaRuntime(one);

		expect(getActiveRuntime()).toBe(one);
	});

	it("is the resolver's answer once one is installed", () => {
		// What a server needs: the answer depends on which request is running, and
		// no module-level pointer can know that.
		const perRequest = runtime("per-request");
		setActiveLankaRuntime(runtime("the process"));
		setLankaRuntimeResolver(() => perRequest);

		expect(getActiveRuntime()).toBe(perRequest);
	});

	// The whole reason the seam exists. A fallback would turn "this ran outside a
	// request" into one request quietly reading another request's framework.
	it("does NOT fall back to the module pointer when the resolver says none", () => {
		setActiveLankaRuntime(runtime("the last request to start"));
		setLankaRuntimeResolver(() => null);

		expect(getActiveRuntime()).toBeNull();
	});

	it("goes back to the module pointer when the resolver is removed", () => {
		const one = runtime("one");
		setActiveLankaRuntime(one);
		setLankaRuntimeResolver(() => null);

		setLankaRuntimeResolver(null);

		expect(getActiveRuntime()).toBe(one);
	});

	it("asks the resolver on every read, not once", () => {
		// A cached first answer would serve request one's instance to request two.
		const one = runtime("first");
		const two = runtime("second");
		let current = one;
		setLankaRuntimeResolver(() => current);

		const first = getActiveRuntime();
		current = two;

		expect([first, getActiveRuntime()]).toEqual([one, two]);
	});
});

describe("requiring an instance", () => {
	afterEach(() => {
		setLankaRuntimeResolver(null);
		setActiveLankaRuntime(null);
	});

	it("returns the active one", () => {
		const one = runtime("one");
		setActiveLankaRuntime(one);

		expect(requireActiveRuntime()).toBe(one);
	});

	it("names the start-up mistake when nothing is active at all", async () => {
		// The state a consumer is in before their first `createLanka` is a copy
		// that NEVER had an instance. The kit's setup creates one before every
		// test, so clearing the pointer here would model "had one and lost it",
		// which says something else; a fresh evaluation is what a page starts as.
		setActiveLankaRuntime(null);
		vi.resetModules();
		const fresh = await import("./activeRuntime");

		expect(() => fresh.requireActiveRuntime()).toThrow(/createLanka/);
		expect(() => fresh.requireActiveRuntime()).not.toThrow(/was active in this copy/);
	});

	it("names the SCOPE mistake instead when a resolver is installed", () => {
		// Two different mistakes with two different fixes: one is "you never
		// started the framework", the other is "you started it per request and this
		// code ran outside one". A single message would send half the readers to
		// the wrong place.
		setLankaRuntimeResolver(() => null);

		expect(() => requireActiveRuntime()).toThrow(/request scope/);
	});
});
