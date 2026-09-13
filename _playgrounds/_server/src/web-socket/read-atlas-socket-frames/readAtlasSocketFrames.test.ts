import { describe, expect, it } from "vitest";
import { readAtlasSocketFrames } from "./readAtlasSocketFrames";
import { writeAtlasSocketFrame } from "../write-atlas-socket-frame/writeAtlasSocketFrame";

/** A client frame: masked, because a browser masks every one of them. */
const masked = (opcode: number, text: string): Buffer => {
	const payload = Buffer.from(text, "utf8");
	const key = Buffer.of(0x0a, 0x1b, 0x2c, 0x3d);
	const body = Buffer.from(payload.map((byte, index) => byte ^ key[index % 4]));

	const head =
		payload.length < 126
			? Buffer.of(0x80 | opcode, 0x80 | payload.length)
			: Buffer.concat([Buffer.of(0x80 | opcode, 0x80 | 126), lengthOf(payload.length)]);

	return Buffer.concat([head, key, body]);
};

const lengthOf = (length: number): Buffer => {
	const bytes = Buffer.alloc(2);
	bytes.writeUInt16BE(length, 0);

	return bytes;
};

describe("readAtlasSocketFrames", () => {
	it("reads a short masked text frame", () => {
		const { frames, rest } = readAtlasSocketFrames(masked(1, "hello"));

		expect(frames).toHaveLength(1);
		expect(frames[0].opcode).toBe(1);
		expect(frames[0].payload.toString("utf8")).toBe("hello");
		expect(rest).toHaveLength(0);
	});

	it("reads two frames that arrived in one chunk", () => {
		const both = Buffer.concat([masked(1, "one"), masked(1, "two")]);

		expect(readAtlasSocketFrames(both).frames.map((frame) => frame.payload.toString())).toEqual(
			["one", "two"],
		);
	});

	it("keeps a frame that is not all here yet, rather than guessing at it", () => {
		// The failure this prevents never reproduces: bytes arrive in chunks the
		// network chose, and a reader that assumed whole frames works in every test
		// and loses messages under load.
		const whole = masked(1, "hello");
		const first = readAtlasSocketFrames(whole.subarray(0, 6));

		expect(first.frames).toHaveLength(0);
		expect(first.rest).toHaveLength(6);

		const second = readAtlasSocketFrames(Buffer.concat([first.rest, whole.subarray(6)]));

		expect(second.frames[0].payload.toString()).toBe("hello");
	});

	it("reads a payload long enough to need the 16-bit length", () => {
		const long = "x".repeat(400);

		expect(readAtlasSocketFrames(masked(1, long)).frames[0].payload.toString()).toBe(long);
	});

	it("reads a close frame by its opcode", () => {
		expect(readAtlasSocketFrames(masked(8, "")).frames[0].opcode).toBe(8);
	});

	it("reads back what the writer wrote, unmasked", () => {
		// The server MUST NOT mask, so the reader has to accept both — and this is
		// the pair that proves the two halves agree about the length forms.
		const written = writeAtlasSocketFrame(1, Buffer.from("y".repeat(300), "utf8"));

		expect(readAtlasSocketFrames(written).frames[0].payload.toString()).toBe("y".repeat(300));
	});
});
