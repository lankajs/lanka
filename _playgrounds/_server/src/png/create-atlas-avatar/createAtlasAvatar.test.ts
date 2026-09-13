import { describe, expect, it } from "vitest";
import { createAtlasAvatar } from "./createAtlasAvatar";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("createAtlasAvatar", () => {
	it("writes something a decoder will accept as a PNG", () => {
		const png = createAtlasAvatar("c-1");

		expect(png.subarray(0, 8)).toEqual(SIGNATURE);
		expect(png.includes(Buffer.from("IHDR", "ascii"))).toBe(true);
		expect(png.includes(Buffer.from("IEND", "ascii"))).toBe(true);
	});

	it("answers the same bytes for the same id, which is what makes it cacheable", () => {
		// A cache that never checks freshness may only be pointed at something
		// that cannot change. If this ever stopped holding, every cached avatar
		// would be wrong and nothing would say so.
		expect(createAtlasAvatar("c-2")).toEqual(createAtlasAvatar("c-2"));
	});

	it("answers different bytes for different people", () => {
		// Two identical avatars would let a cache test pass with the cache broken:
		// the wrong entry and the right one would be the same image.
		expect(createAtlasAvatar("c-1")).not.toEqual(createAtlasAvatar("c-2"));
	});
});
