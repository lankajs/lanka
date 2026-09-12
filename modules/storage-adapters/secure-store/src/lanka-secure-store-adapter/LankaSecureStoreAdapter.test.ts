import { describe, expect, it } from "vitest";
import { LankaSecureStoreAdapter } from "./LankaSecureStoreAdapter";
import type { ILankaSecureStoreEngine } from "../_interfaces/ILankaSecureStoreEngine";

/**
 * The index, under the conditions the playground's scenes do not reach.
 *
 * Every clause of the port is asserted against this adapter by the conformance
 * suite, one operation at a time and with an engine that never refuses. The
 * index is this package's own invention, and it is exactly what those conditions
 * hide: what happens when two writes overlap, and what is left behind when the
 * keychain fails halfway.
 *
 * The promise all of it protects is one sentence — a sign-out removes every
 * secret this adapter wrote — and it is the sentence that has no second chance.
 */
const keychain = (): ILankaSecureStoreEngine & { rows: Map<string, string> } => {
	const rows = new Map<string, string>();

	return {
		rows,
		getItemAsync: (key) => Promise.resolve(rows.get(key) ?? null),
		setItemAsync: (key, value) => {
			rows.set(key, value);
			return Promise.resolve();
		},
		deleteItemAsync: (key) => {
			rows.delete(key);
			return Promise.resolve();
		},
	};
};

/** A keychain that answers a tick late, so two calls can genuinely overlap. */
const slowKeychain = (): ILankaSecureStoreEngine & { rows: Map<string, string> } => {
	const engine = keychain();
	const later = <TValue>(value: TValue): Promise<TValue> =>
		new Promise((resolve) => setTimeout(() => resolve(value), 0));

	return {
		rows: engine.rows,
		getItemAsync: async (key) => await later(await engine.getItemAsync(key)),
		setItemAsync: async (key, value) => {
			await later(undefined);
			await engine.setItemAsync(key, value);
		},
		deleteItemAsync: async (key) => {
			await later(undefined);
			await engine.deleteItemAsync(key);
		},
	};
};

describe("LankaSecureStoreAdapter — two writes at once", () => {
	it("remembers both keys when they are written together", async () => {
		const engine = slowKeychain();
		const adapter = new LankaSecureStoreAdapter(engine);

		// An application storing an access token and a refresh token does this. Read
		// and written one at a time the index is fine; overlapped, both writes read
		// the same empty index and the second one publishes it without the first.
		await Promise.all([
			adapter.setItem("auth.access", "a"),
			adapter.setItem("auth.refresh", "r"),
		]);

		expect((await adapter.keys()).sort()).toEqual(["auth.access", "auth.refresh"]);
	});

	it("signs out completely after writes that overlapped", async () => {
		const engine = slowKeychain();
		const adapter = new LankaSecureStoreAdapter(engine);

		await Promise.all([
			adapter.setItem("auth.access", "a"),
			adapter.setItem("auth.refresh", "r"),
			adapter.setItem("auth.device", "d"),
		]);
		await adapter.clear();

		// The failure this is written against: a token the index forgot survives the
		// sign-out, on the device, under a name nobody will think to look for.
		expect([...engine.rows], "the keychain after a sign-out").toEqual([]);
	});

	it("keeps the index whole when removals overlap writes", async () => {
		const engine = slowKeychain();
		const adapter = new LankaSecureStoreAdapter(engine);
		await adapter.setItem("auth.access", "a");

		await Promise.all([
			adapter.setItem("auth.refresh", "r"),
			adapter.removeItem("auth.access"),
		]);

		expect(await adapter.keys()).toEqual(["auth.refresh"]);
	});
});

describe("LankaSecureStoreAdapter — a keychain that fails halfway", () => {
	/** Refuses the write whose key matches, and takes everything else. */
	const refusing = (failOn: RegExp) => {
		const engine = keychain();

		return {
			rows: engine.rows,
			getItemAsync: engine.getItemAsync,
			deleteItemAsync: engine.deleteItemAsync,
			setItemAsync: (key: string, value: string) =>
				failOn.test(key)
					? Promise.reject(new Error(`the keychain refused ${key}`))
					: engine.setItemAsync(key, value),
		};
	};

	it("leaves no secret the index cannot name when the index write fails", async () => {
		const engine = refusing(/index/);
		const adapter = new LankaSecureStoreAdapter(engine);

		await expect(adapter.setItem("auth.access", "a")).rejects.toThrow(/refused/);

		// Whatever reached the keychain must be reachable by `clear()`. A row the
		// index never learned about is a secret that outlives every sign-out — and a
		// locked keychain, a full disk and a process killed between two writes all
		// produce exactly this.
		await adapter.clear();

		expect([...engine.rows]).toEqual([]);
	});

	it("reports the failure rather than swallowing it", async () => {
		const engine = refusing(/auth/);
		const adapter = new LankaSecureStoreAdapter(engine);

		await expect(adapter.setItem("auth.access", "a")).rejects.toThrow(/refused/);
		expect(await adapter.getItem("auth.access")).toBeNull();
	});
});
