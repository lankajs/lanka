import { afterEach, describe, expect, it, vi } from "vitest";
import { LankaCacheStorageBlobAdapter } from "./LankaCacheStorageBlobAdapter";

/**
 * The Blob → ArrayBuffer ladder, exercised through the only consumer that needs
 * it.
 *
 * Three rungs, because "any device, any environment, any version" includes
 * engines that have Cache Storage but not `Blob.arrayBuffer()`.
 */

const makeCacheStorage = () => {
	const entries = new Map<string, Response>();
	const cache = {
		match: (url: string) => Promise.resolve(entries.get(url)?.clone()),
		put: (url: string, response: Response) => {
			entries.set(url, response);
			return Promise.resolve();
		},
		delete: () => Promise.resolve(true),
		keys: () => Promise.resolve([]),
	} as unknown as Cache;

	return {
		cacheStorage: {
			open: () => Promise.resolve(cache),
			delete: () => Promise.resolve(true),
		} as unknown as CacheStorage,
		entries,
	};
};

/** A Blob whose `arrayBuffer` method is deliberately absent. */
const makeLegacyBlob = (bytes = 8): Blob => {
	const blob = new Blob([new Uint8Array(bytes)], { type: "image/webp" });
	Object.defineProperty(blob, "arrayBuffer", {
		value: undefined,
		configurable: true,
	});
	return blob;
};

const now = () => 1_700_000_000_000;

const putAndRead = async (blob: Blob) => {
	const fake = makeCacheStorage();
	const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);
	await adapter.put({
		key: "k",
		blob,
		lastUsedAt: now(),
		size: blob.size,
	});
	return adapter.get("k");
};

describe("Blob → ArrayBuffer ladder", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rung 1: prefers Blob.arrayBuffer when the engine has it", async () => {
		// jsdom's Blob has no `arrayBuffer` at all, so a modern engine is simulated
		// by defining it — which also proves the ladder prefers it to FileReader.
		const blob = new Blob([new Uint8Array(12)], { type: "image/webp" });
		const arrayBuffer = vi.fn(() => Promise.resolve(new Uint8Array(12).buffer));
		Object.defineProperty(blob, "arrayBuffer", {
			value: arrayBuffer,
			configurable: true,
		});

		const record = await putAndRead(blob);

		expect(arrayBuffer).toHaveBeenCalledTimes(1);
		expect(record?.size).toBe(12);
	});

	it("rung 2: falls back to FileReader on engines without Blob.arrayBuffer", async () => {
		const record = await putAndRead(makeLegacyBlob(20));

		expect(record?.size).toBe(20);
	});

	it("rung 2 preserves the MIME type, so the rebuilt Blob is faithful", async () => {
		const record = await putAndRead(makeLegacyBlob());

		expect(record?.blob.type).toBe("image/webp");
	});

	it("rung 3: falls back to Response when FileReader is gone too", async () => {
		vi.stubGlobal("FileReader", undefined);

		const record = await putAndRead(makeLegacyBlob(16));

		// Resolves rather than throwing — the contract of the last rung. Byte
		// fidelity here depends on the engine honouring a Blob body in
		// `new Response(blob)`; jsdom stringifies it, which is exactly why this rung
		// sits BELOW `FileReader` rather than above it.
		expect(record).not.toBeNull();
	});

	it("rejects — rather than hangs — when no rung is available", async () => {
		vi.stubGlobal("FileReader", undefined);
		vi.stubGlobal("Response", undefined);

		// Rejecting is what lets the probe fail this rung and step down to memory; a
		// hang would freeze the cache behind an unresolved promise.
		await expect(putAndRead(makeLegacyBlob())).rejects.toThrow();
	});
});
