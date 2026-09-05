import { describe, expect, it } from "vitest";
import { readLengthPrefixedFrames } from "./readLengthPrefixedFrames";
import { encodeLengthPrefixed } from "../encode-length-prefixed/encodeLengthPrefixed";

const trailers = (text: string): Uint8Array => {
	const body = new TextEncoder().encode(text);
	const framed = encodeLengthPrefixed(body);
	framed[0] = 0x80;
	return framed;
};

const joined = (...parts: Uint8Array[]): Uint8Array => {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const all = new Uint8Array(total);
	let at = 0;
	for (const part of parts) {
		all.set(part, at);
		at += part.length;
	}
	return all;
};

describe("readLengthPrefixedFrames", () => {
	it("reads two whole frames out of one buffer", () => {
		const { frames, rest } = readLengthPrefixedFrames(
			joined(
				encodeLengthPrefixed(new Uint8Array([1])),
				encodeLengthPrefixed(new Uint8Array([2])),
			),
		);

		expect(frames.map((frame) => [...frame.data])).toEqual([[1], [2]]);
		expect(rest).toHaveLength(0);
	});

	it("keeps a header that is not complete yet", () => {
		// Bytes arrive in chunks the network chose, and a five-byte header can be
		// split across two reads.
		const { frames, rest } = readLengthPrefixedFrames(new Uint8Array([0, 0, 0]));

		expect(frames).toEqual([]);
		expect([...rest]).toEqual([0, 0, 0]);
	});

	it("keeps a message that is not complete yet", () => {
		const whole = encodeLengthPrefixed(new Uint8Array([1, 2, 3]));
		const { frames, rest } = readLengthPrefixedFrames(whole.slice(0, 6));

		expect(frames).toEqual([]);
		expect(rest).toHaveLength(6);
	});

	it("reads what is whole and keeps the remainder", () => {
		const first = encodeLengthPrefixed(new Uint8Array([1]));
		const second = encodeLengthPrefixed(new Uint8Array([2, 2, 2]));
		const { frames, rest } = readLengthPrefixedFrames(joined(first, second.slice(0, 4)));

		expect(frames).toHaveLength(1);
		expect(rest).toHaveLength(4);
	});

	it("marks the trailers block for what it is", () => {
		const { frames } = readLengthPrefixedFrames(trailers("grpc-status: 0\r\n"));

		expect(frames[0]?.isTrailers).toBe(true);
	});

	it("answers nothing for an empty buffer", () => {
		expect(readLengthPrefixedFrames(new Uint8Array(0))).toEqual({
			frames: [],
			rest: new Uint8Array(0),
		});
	});
});
