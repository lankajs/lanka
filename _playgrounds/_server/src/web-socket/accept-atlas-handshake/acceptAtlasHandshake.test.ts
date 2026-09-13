import { describe, expect, it } from "vitest";
import { acceptAtlasHandshake } from "./acceptAtlasHandshake";

describe("acceptAtlasHandshake", () => {
	it("answers the value the specification's own example states", () => {
		// RFC 6455 §1.3 carries this pair. Asserting against a value this code
		// produced would only prove it agrees with itself — and a handshake that
		// agrees with itself is a socket no browser will open.
		expect(acceptAtlasHandshake("dGhlIHNhbXBsZSBub25jZQ==")).toBe(
			"s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
		);
	});

	it("answers a different value for a different key", () => {
		expect(acceptAtlasHandshake("AAAAAAAAAAAAAAAAAAAAAA==")).not.toBe(
			acceptAtlasHandshake("dGhlIHNhbXBsZSBub25jZQ=="),
		);
	});
});
