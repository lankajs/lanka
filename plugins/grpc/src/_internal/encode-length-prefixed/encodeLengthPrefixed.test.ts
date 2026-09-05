import { describe, expect, it } from "vitest";
import { encodeLengthPrefixed } from "./encodeLengthPrefixed";

describe("encodeLengthPrefixed", () => {
	it("writes the flag, the length and the message", () => {
		const framed = encodeLengthPrefixed(new Uint8Array([1, 2, 3]));

		expect([...framed]).toEqual([0, 0, 0, 0, 3, 1, 2, 3]);
	});

	it("writes the length big-endian", () => {
		// The wire is big-endian and a platform's own order is not: written by hand
		// with shifts this is correct on one machine and wrong on another.
		const framed = encodeLengthPrefixed(new Uint8Array(258));

		expect([...framed.slice(0, 5)]).toEqual([0, 0, 0, 1, 2]);
	});

	it("frames an empty message rather than refusing it", () => {
		// A request with no fields is an ordinary RPC, and gRPC sends it as a
		// zero-length frame rather than as no body at all.
		expect([...encodeLengthPrefixed(new Uint8Array(0))]).toEqual([0, 0, 0, 0, 0]);
	});
});
