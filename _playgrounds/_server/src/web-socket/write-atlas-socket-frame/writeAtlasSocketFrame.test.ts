import { describe, expect, it } from "vitest";
import { writeAtlasSocketFrame } from "./writeAtlasSocketFrame";

describe("writeAtlasSocketFrame", () => {
	it("never sets the mask bit, which a server may not", () => {
		// A browser closes the connection on a masked frame from a server, and the
		// symptom is "the socket opens and immediately dies".
		const frame = writeAtlasSocketFrame(1, Buffer.from("hello"));

		expect(frame[1] & 0x80).toBe(0);
	});

	it("marks the frame final, since nothing here is continued", () => {
		expect(writeAtlasSocketFrame(1, Buffer.from("hello"))[0] & 0x80).toBe(0x80);
	});

	it("uses the 7-bit length for a short payload", () => {
		const frame = writeAtlasSocketFrame(1, Buffer.alloc(5));

		expect(frame[1]).toBe(5);
		expect(frame).toHaveLength(7);
	});

	it("moves to the 16-bit length at 126 bytes", () => {
		// A 200-byte payload written in the 7-bit form is a frame every client
		// rejects — and it only shows up once a message grows past 125 characters.
		const frame = writeAtlasSocketFrame(1, Buffer.alloc(200));

		expect(frame[1]).toBe(126);
		expect(frame.readUInt16BE(2)).toBe(200);
	});

	it("moves to the 64-bit length past 65535 bytes", () => {
		const frame = writeAtlasSocketFrame(1, Buffer.alloc(70_000));

		expect(frame[1]).toBe(127);
		expect(Number(frame.readBigUInt64BE(2))).toBe(70_000);
	});

	it("carries the opcode it was given", () => {
		expect(writeAtlasSocketFrame(10, Buffer.alloc(0))[0] & 0x0f).toBe(10);
	});
});
