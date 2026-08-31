import { describe, expect, it } from "vitest";
import { readLankaHeaders } from "./readLankaHeaders";

describe("reading the incoming headers", () => {
	it("takes identity and leaves the connection alone", () => {
		// `host` and `content-length` describe the browser's connection to the host
		// framework, not the framework's connection to the API.
		const found = readLankaHeaders({
			cookie: "session=abc",
			authorization: "Bearer t",
			host: "example.com",
			"content-length": "40",
		});

		expect(found).toEqual({ cookie: "session=abc", authorization: "Bearer t" });
	});

	it("reads a `Headers` object, which is what a loader is handed", () => {
		const headers = new Headers({ Cookie: "session=abc", Host: "example.com" });

		expect(readLankaHeaders(headers)).toEqual({ cookie: "session=abc" });
	});

	it("lower-cases what it finds, whatever case it arrived in", () => {
		expect(readLankaHeaders({ Cookie: "session=abc" })).toEqual({ cookie: "session=abc" });
	});

	it("takes a different allow-list when the API needs one", () => {
		const found = readLankaHeaders({ "x-tenant": "acme", cookie: "session=abc" }, ["x-tenant"]);

		expect(found).toEqual({ "x-tenant": "acme" });
	});

	it("skips a header the host reported as absent", () => {
		expect(readLankaHeaders({ cookie: undefined })).toEqual({});
	});

	it("takes nothing at all when the allow-list is empty", () => {
		expect(readLankaHeaders({ cookie: "session=abc" }, [])).toEqual({});
	});
});
