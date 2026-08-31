import { describe, it, expect, beforeEach } from "vitest";
import { LankaWebStorageAdapter } from "./LankaWebStorageAdapter";

class FakeStorage implements Storage {
	private store = new Map<string, string>();

	get length() {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.has(key) ? this.store.get(key)! : null;
	}

	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}

describe("LankaWebStorageAdapter", () => {
	let storage: FakeStorage;
	let adapter: LankaWebStorageAdapter;

	beforeEach(() => {
		storage = new FakeStorage();
		adapter = new LankaWebStorageAdapter(storage);
	});

	// --- Asynchronous methods ---
	it("stores and returns a value — async", async () => {
		await adapter.setItem("foo", "bar");
		const value = await adapter.getItem("foo");
		expect(value).toBe("bar");
	});

	it("returns null for a missing key — async", async () => {
		const value = await adapter.getItem("unknown");
		expect(value).toBeNull();
	});

	it("removes a value — async", async () => {
		await adapter.setItem("foo", "bar");
		await adapter.removeItem("foo");
		const value = await adapter.getItem("foo");
		expect(value).toBeNull();
	});

	it("clears everything — async", async () => {
		await adapter.setItem("a", "1");
		await adapter.setItem("b", "2");
		await adapter.clear();
		expect(await adapter.getItem("a")).toBeNull();
		expect(await adapter.getItem("b")).toBeNull();
	});

	it("overwrites an existing value — async", async () => {
		await adapter.setItem("foo", "bar1");
		await adapter.setItem("foo", "bar2");
		const value = await adapter.getItem("foo");
		expect(value).toBe("bar2");
	});

	// --- Synchronous methods ---
	it("stores and returns a value — sync", () => {
		adapter.setItemSync("foo", "bar");
		const value = adapter.getItemSync("foo");
		expect(value).toBe("bar");
	});

	it("returns null for a missing key — sync", () => {
		const value = adapter.getItemSync("unknown");
		expect(value).toBeNull();
	});

	it("removes a value — sync", () => {
		adapter.setItemSync("foo", "bar");
		adapter.removeItemSync("foo");
		const value = adapter.getItemSync("foo");
		expect(value).toBeNull();
	});

	it("clears everything — sync", () => {
		adapter.setItemSync("a", "1");
		adapter.setItemSync("b", "2");
		adapter.clearSync();
		expect(adapter.getItemSync("a")).toBeNull();
		expect(adapter.getItemSync("b")).toBeNull();
	});

	it("overwrites an existing value — sync", () => {
		adapter.setItemSync("foo", "bar1");
		adapter.setItemSync("foo", "bar2");
		const value = adapter.getItemSync("foo");
		expect(value).toBe("bar2");
	});
});
