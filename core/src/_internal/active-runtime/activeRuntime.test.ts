import { afterEach, describe, expect, it } from "vitest";
import {
	getActiveRuntime,
	requireActiveRuntime,
	setActiveRuntime,
	setLankaRuntimeResolver,
} from "./activeRuntime";
import type { ILankaRuntime } from "./activeRuntime";

/** Enough of a runtime to be told apart from another one. */
const runtime = (name: string) => ({ name }) as unknown as ILankaRuntime;

describe("which instance is active", () => {
	afterEach(() => {
		setLankaRuntimeResolver(null);
		setActiveRuntime(null);
	});

	it("is the module pointer when nothing else answers", () => {
		const one = runtime("one");
		setActiveRuntime(one);

		expect(getActiveRuntime()).toBe(one);
	});

	it("is the resolver's answer once one is installed", () => {
		// What a server needs: the answer depends on which request is running, and
		// no module-level pointer can know that.
		const perRequest = runtime("per-request");
		setActiveRuntime(runtime("the process"));
		setLankaRuntimeResolver(() => perRequest);

		expect(getActiveRuntime()).toBe(perRequest);
	});

	// The whole reason the seam exists. A fallback would turn "this ran outside a
	// request" into one request quietly reading another request's framework.
	it("does NOT fall back to the module pointer when the resolver says none", () => {
		setActiveRuntime(runtime("the last request to start"));
		setLankaRuntimeResolver(() => null);

		expect(getActiveRuntime()).toBeNull();
	});

	it("goes back to the module pointer when the resolver is removed", () => {
		const one = runtime("one");
		setActiveRuntime(one);
		setLankaRuntimeResolver(() => null);

		setLankaRuntimeResolver(null);

		expect(getActiveRuntime()).toBe(one);
	});

	it("asks the resolver on every read, not once", () => {
		// A cached first answer would serve request one's instance to request two.
		let current = runtime("first");
		setLankaRuntimeResolver(() => current);

		const first = getActiveRuntime();
		current = runtime("second");

		expect([first, getActiveRuntime()]).toEqual([{ name: "first" }, { name: "second" }]);
	});
});

describe("requiring an instance", () => {
	afterEach(() => {
		setLankaRuntimeResolver(null);
		setActiveRuntime(null);
	});

	it("returns the active one", () => {
		const one = runtime("one");
		setActiveRuntime(one);

		expect(requireActiveRuntime()).toBe(one);
	});

	it("names the start-up mistake when nothing is active at all", () => {
		// The kit's setup creates an instance before every test, so "nothing
		// active" has to be asked for: this is the state a consumer is in before
		// their first `createLanka`, not a state a suite drifts into.
		setActiveRuntime(null);

		expect(() => requireActiveRuntime()).toThrow(/createLanka/);
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
