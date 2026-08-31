import { describe, expect, it } from "vitest";
import { createLankaHost } from "./createLankaHost";

describe("createLankaHost", () => {
	// An application served from its API's origin, or one whose gateways write
	// whole URLs, has nothing to put in a base URL. Empty is not a guess.
	it("needs nothing at all", () => {
		const host = createLankaHost();

		expect(host.apiBaseUrl).toBe("");
		expect(host.networkErrorMessage()).toBe("Network error");
	});

	// The defect this shape prevents: a caller forwarding its own optional config
	// passes `{ apiBaseUrl: undefined }`, and a spread would put `undefined` in
	// front of every request URL as the string "undefined".
	it("treats an explicit undefined as absent", () => {
		const host = createLankaHost({ apiBaseUrl: undefined, networkErrorMessage: undefined });

		expect(host.apiBaseUrl).toBe("");
		expect(host.networkErrorMessage()).toBe("Network error");
	});

	it("takes a message without a base URL", () => {
		expect(createLankaHost({ networkErrorMessage: () => "off" }).apiBaseUrl).toBe("");
	});

	it("completes a base URL into a whole host", () => {
		const host = createLankaHost({ apiBaseUrl: "https://api.test" });

		expect(host.apiBaseUrl).toBe("https://api.test");
		expect(typeof host.httpErrorMessage).toBe("function");
		expect(typeof host.networkErrorMessage).toBe("function");
		expect(typeof host.timeoutErrorMessage).toBe("function");
	});

	it("puts the status in the http message, so the default is still useful", () => {
		expect(createLankaHost({ apiBaseUrl: "/api" }).httpErrorMessage(503)).toContain("503");
	});

	// The point of the factory: a consumer replaces the copy a field at a time
	// rather than restating all four to change one.
	it("takes one message without asking for the other two", () => {
		const host = createLankaHost({
			apiBaseUrl: "/api",
			networkErrorMessage: () => "no connection",
		});

		expect(host.networkErrorMessage()).toBe("no connection");
		expect(host.timeoutErrorMessage()).toBe("Request timed out");
	});

	it("lets every message be replaced", () => {
		const host = createLankaHost({
			apiBaseUrl: "/api",
			httpErrorMessage: () => "a",
			networkErrorMessage: () => "b",
			timeoutErrorMessage: () => "c",
		});

		expect([
			host.httpErrorMessage(500),
			host.networkErrorMessage(),
			host.timeoutErrorMessage(),
		]).toEqual(["a", "b", "c"]);
	});

	it("answers a new object each time, so two apps cannot share one host", () => {
		const first = createLankaHost({ apiBaseUrl: "/one" });
		const second = createLankaHost({ apiBaseUrl: "/two" });

		expect(first).not.toBe(second);
		expect(first.apiBaseUrl).toBe("/one");
	});
});
