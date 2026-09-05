import { describe, expect, it } from "vitest";
import { parseTrailers } from "./parseTrailers";

describe("parseTrailers", () => {
	it("reads the lines the specification describes", () => {
		expect(parseTrailers("grpc-status: 0\r\ngrpc-message: \r\n")).toEqual({
			"grpc-status": "0",
			"grpc-message": "",
		});
	});

	it("accepts a bare newline too", () => {
		// Several implementations send one, and refusing it loses the status
		// entirely rather than loudly.
		expect(parseTrailers("grpc-status: 7\n")).toEqual({ "grpc-status": "7" });
	});

	it("lower-cases the names", () => {
		// HTTP header names are case-insensitive and this one has been seen spelled
		// three ways by three proxies. Matching exactly reports a missing status for
		// a response that carried one.
		expect(parseTrailers("Grpc-Status: 5\r\n")["grpc-status"]).toBe("5");
	});

	it("skips a line that is not a header", () => {
		expect(parseTrailers("nonsense\r\n: novalue\r\ngrpc-status: 0")).toEqual({
			"grpc-status": "0",
		});
	});

	it("keeps a colon inside the value", () => {
		expect(parseTrailers("grpc-message: at 10:30")["grpc-message"]).toBe("at 10:30");
	});
});
