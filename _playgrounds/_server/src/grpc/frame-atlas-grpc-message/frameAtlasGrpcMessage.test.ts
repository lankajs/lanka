import { describe, expect, it } from "vitest";
import { frameAtlasGrpcMessage } from "./frameAtlasGrpcMessage";

describe("frameAtlasGrpcMessage", () => {
	it("writes a data frame with a zero flag and a big-endian length", () => {
		const frame = frameAtlasGrpcMessage(Buffer.from("hello"));

		expect(frame[0]).toBe(0);
		expect(frame.readUInt32BE(1)).toBe(5);
		expect(frame.subarray(5).toString()).toBe("hello");
	});

	it("marks a trailers block with the high bit, which is how a reader knows", () => {
		// Without it the status block is read as another message, and the client
		// hands its codec a `grpc-status: 0` line to decode.
		expect(frameAtlasGrpcMessage(Buffer.from("grpc-status:0\r\n"), true)[0]).toBe(0x80);
	});

	it("writes a length a reader can trust for an empty message", () => {
		expect(frameAtlasGrpcMessage(Buffer.alloc(0)).readUInt32BE(1)).toBe(0);
	});

	it("writes the length big-endian, not the platform's way round", () => {
		// A little-endian length is right on no platform and wrong on every one —
		// and it is the kind of mistake that reads as a corrupt stream.
		expect(frameAtlasGrpcMessage(Buffer.alloc(258)).subarray(1, 5)).toEqual(
			Buffer.of(0, 0, 1, 2),
		);
	});
});
