import { describe, expect, it } from "vitest";
import { crc32 } from "./crc32";

describe("crc32", () => {
	it("answers the published check value for the standard input", () => {
		// `0xCBF43926` for "123456789" is the check value every CRC-32
		// implementation is stated against. Asserting against a value this code
		// produced would only prove it is consistent with itself.
		expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
	});

	it("answers zero for nothing", () => {
		expect(crc32(new Uint8Array())).toBe(0);
	});

	it("answers an unsigned number, because a PNG chunk writes it as one", () => {
		// A signed result writes as a negative and produces a chunk no decoder
		// accepts — and the image still renders in the browser that ignores CRCs.
		expect(crc32(new TextEncoder().encode("IEND"))).toBeGreaterThan(0);
	});

	it("notices one changed byte", () => {
		expect(crc32(Uint8Array.of(1, 2, 3))).not.toBe(crc32(Uint8Array.of(1, 2, 4)));
	});
});
