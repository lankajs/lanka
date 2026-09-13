import { describe, expect, it } from "vitest";
import { createAtlasHost } from "./createAtlasHost";

describe("createAtlasHost", () => {
	const host = createAtlasHost("https://atlas.test/api");

	it("carries the base URL every gateway is prefixed with", () => {
		expect(host.apiBaseUrl).toBe("https://atlas.test/api");
	});

	it("tells 'could not answer' from 'would not', because only one is worth retrying", () => {
		expect(host.httpErrorMessage(503)).toBe("Atlas is not answering");
		expect(host.httpErrorMessage(500)).toBe("Atlas is not answering");
		expect(host.httpErrorMessage(404)).toBe("Atlas refused that");
		expect(host.httpErrorMessage(422)).toBe("Atlas refused that");
	});

	it("has words for a request that never arrived", () => {
		expect(host.networkErrorMessage()).toBe("No connection to Atlas");
	});

	it("has words for one that arrived and was not answered", () => {
		// A different sentence from the one above, deliberately: "no connection"
		// sends somebody to their wifi, and the connection was fine.
		expect(host.timeoutErrorMessage()).toBe("Atlas took too long");
	});
});
