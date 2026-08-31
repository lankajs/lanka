/**
 * Clearing cookies, listing keys, watching for changes, and the edge cases
 * around malformed or unusual values.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { lankaCookies } from "./LankaCookies";
describe("LankaCookies — mutation, watching and edge cases", () => {
	beforeEach(() => {
		document.cookie.split(";").forEach((cookie) => {
			const name = cookie.split("=")[0].trim();
			if (name) {
				document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
			}
		});
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("clear", () => {
		it("should remove all cookies", async () => {
			await lankaCookies.set("key1", "value1");
			await lankaCookies.set("key2", "value2");
			await lankaCookies.set("key3", "value3");

			expect(Object.keys(await lankaCookies.getAll()).length).toBe(3);

			await lankaCookies.clear();

			expect(Object.keys(await lankaCookies.getAll()).length).toBe(0);
		});
	});

	describe("keys", () => {
		it("should return empty array when no cookies exist", async () => {
			const keys = await lankaCookies.keys();
			expect(keys).toEqual([]);
		});

		it("should return all cookie keys", async () => {
			await lankaCookies.set("key1", "value1");
			await lankaCookies.set("key2", "value2");
			await lankaCookies.set("key3", "value3");

			const keys = await lankaCookies.keys();
			expect(keys).toHaveLength(3);
			expect(keys).toContain("key1");
			expect(keys).toContain("key2");
			expect(keys).toContain("key3");
		});
	});

	describe("watch", () => {
		it("should detect cookie changes", async () => {
			const callback = vi.fn();
			const unwatch = lankaCookies.watch(callback, 100);

			await lankaCookies.set("watchKey", "value1");

			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(callback).toHaveBeenCalled();
			const callArgs = callback.mock.calls[0][0];
			expect(callArgs.changed).toEqual([{ name: "watchKey", value: "value1" }]);

			unwatch();
		});

		it("should detect cookie deletions", async () => {
			await lankaCookies.set("deleteKey", "value");
			const callback = vi.fn();
			const unwatch = lankaCookies.watch(callback, 100);

			await lankaCookies.remove("deleteKey");

			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(callback).toHaveBeenCalled();
			const callArgs = callback.mock.calls[0][0];
			expect(callArgs.deleted).toEqual([{ name: "deleteKey", value: "value" }]);

			unwatch();
		});

		it("should stop watching when unwatch is called", async () => {
			const callback = vi.fn();
			const unwatch = lankaCookies.watch(callback, 100);

			unwatch();

			await lankaCookies.set("afterUnwatch", "value");
			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(callback).not.toHaveBeenCalled();
		});

		it("should not trigger callback if no changes occur", async () => {
			const callback = vi.fn();
			const unwatch = lankaCookies.watch(callback, 100);

			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(callback).not.toHaveBeenCalled();

			unwatch();
		});

		it("should parse JSON values in watch callback", async () => {
			const callback = vi.fn();
			const unwatch = lankaCookies.watch(callback, 100);

			await lankaCookies.set("jsonWatch", { foo: "bar" });

			await new Promise((resolve) => setTimeout(resolve, 150));

			expect(callback).toHaveBeenCalled();
			const callArgs = callback.mock.calls[0][0];
			expect(callArgs.changed[0].value).toEqual({
				foo: "bar",
			});

			unwatch();
		});
	});

	describe("edge cases", () => {
		it("should handle empty string value", async () => {
			await lankaCookies.set("emptyKey", "");
			const value = await lankaCookies.get("emptyKey");
			expect(value).toBeNull();
		});

		it("should handle numeric string values with auto-parse", async () => {
			await lankaCookies.set("numKey", "123");
			const value = await lankaCookies.get("numKey");
			expect(value).toBe(123);
		});

		it("should handle boolean string values with auto-parse", async () => {
			await lankaCookies.set("boolKey", "true");
			const value = await lankaCookies.get("boolKey");
			expect(value).toBe(true);
		});

		it("should handle non-JSON string values", async () => {
			await lankaCookies.set("plainKey", "just a string");
			const value = await lankaCookies.get("plainKey");
			expect(value).toBe("just a string");
		});

		it("should handle cookie names with equals signs in value", async () => {
			await lankaCookies.set("eqKey", "a=b=c");
			const value = await lankaCookies.get("eqKey");
			expect(value).toBe("a=b=c");
		});

		it("should handle null JSON values", async () => {
			await lankaCookies.set("nullKey", "null");
			const value = await lankaCookies.get("nullKey");
			expect(value).toBeNull();
		});

		it("should handle arrays", async () => {
			const arr = [1, 2, 3, "test"];
			await lankaCookies.set("arrayKey", arr);
			const value = await lankaCookies.get("arrayKey");
			expect(value).toEqual(arr);
		});

		it("should handle nested objects", async () => {
			const nested = { a: { b: { c: "deep" } } };
			await lankaCookies.set("nestedKey", nested);
			const value = await lankaCookies.get("nestedKey");
			expect(value).toEqual(nested);
		});
	});
});
