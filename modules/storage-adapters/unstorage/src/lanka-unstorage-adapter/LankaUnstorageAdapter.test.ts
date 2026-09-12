import { describe, expect, it } from "vitest";
import { LankaUnstorageAdapter } from "./LankaUnstorageAdapter";
import type { ILankaUnstorageEngine } from "../_interfaces/ILankaUnstorageEngine";

/**
 * The answers a DRIVER can give that the memory driver never does.
 *
 * The playground runs this adapter over the real library, which is the right
 * evidence for everything the memory driver can produce. It cannot produce
 * these: a filesystem answers a raw read with bytes, and some drivers answer a
 * missing key with `undefined` rather than `null`. Both reach a caller as a
 * value that is not a string, which is exactly what the port forbids.
 *
 * Hand-built engines rather than a driver, because installing a Redis to assert
 * two lines is a test nobody runs twice.
 */
const engineAnswering = (raw: unknown): ILankaUnstorageEngine => ({
	getItemRaw: () => Promise.resolve(raw),
	setItemRaw: () => Promise.resolve(),
	removeItem: () => Promise.resolve(),
	clear: () => Promise.resolve(),
	getKeys: () => Promise.resolve([]),
});

describe("LankaUnstorageAdapter — what a driver may answer", () => {
	it("decodes the bytes a filesystem driver answers", async () => {
		const adapter = new LankaUnstorageAdapter(
			engineAnswering(new TextEncoder().encode("half a sentence")),
		);

		// Handed on unchanged, this would reach a ViewModel as a `Uint8Array` under
		// a type that says `string` — and break at whatever read it first.
		expect(await adapter.getItem("draft")).toBe("half a sentence");
	});

	it("answers null for the undefined some drivers use for a missing key", async () => {
		const adapter = new LankaUnstorageAdapter(engineAnswering(undefined));

		expect(await adapter.getItem("never.written")).toBeNull();
	});

	it("answers null for an explicit null", async () => {
		const adapter = new LankaUnstorageAdapter(engineAnswering(null));

		expect(await adapter.getItem("never.written")).toBeNull();
	});

	it("passes a string through without touching it", async () => {
		const adapter = new LankaUnstorageAdapter(engineAnswering("{}"));

		expect(await adapter.getItem("draft")).toBe("{}");
	});
});
