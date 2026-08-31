/**
 * Reading and writing cookies: availability detection, set/get round-trips,
 * enumeration and presence checks.
 *
 * Removal, key listing, change watching and edge cases:
 * `lankaCookies.mutations.test.ts`.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { lankaCookies } from "./LankaCookies";
describe("LankaCookies — read and write", () => {
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

	describe("isEnabled", () => {
		it("should return true when cookies are enabled", () => {
			expect(lankaCookies.isEnabled()).toBe(true);
		});

		it("should return false when navigator.cookieEnabled throws", () => {
			const originalNavigator = global.navigator;
			Object.defineProperty(global, "navigator", {
				value: {
					get cookieEnabled() {
						throw new Error("Not available");
					},
				},
				configurable: true,
			});

			expect(lankaCookies.isEnabled()).toBe(false);

			Object.defineProperty(global, "navigator", {
				value: originalNavigator,
				configurable: true,
			});
		});
	});

	describe("set and get", () => {
		it("should set and get a string cookie", async () => {
			await lankaCookies.set("testKey", "testValue");
			const value = await lankaCookies.get("testKey");
			expect(value).toBe("testValue");
		});

		it("should set and get an object cookie", async () => {
			const obj = { foo: "bar", num: 123 };
			await lankaCookies.set("objKey", obj);
			const value = await lankaCookies.get("objKey");
			expect(value).toEqual(obj);
		});

		it("should return null for non-existent cookie", async () => {
			const value = await lankaCookies.get("nonExistent");
			expect(value).toBeNull();
		});

		it("should set cookie with expires as Date", async () => {
			const futureDate = new Date(Date.now() + 86400000);
			await lankaCookies.set("expiresKey", "value", {
				expires: futureDate,
			});
			const value = await lankaCookies.get("expiresKey");
			expect(value).toBe("value");
		});

		it("should set cookie with expires as number (days)", async () => {
			await lankaCookies.set("expiresNumKey", "value", {
				expires: 1,
			});
			const value = await lankaCookies.get("expiresNumKey");
			expect(value).toBe("value");
		});

		it("should set cookie with secure flag", async () => {
			await lankaCookies.set("secureKey", "value", {
				secure: true,
			});
			expect(document.cookie).toContain("secureKey=value");
		});

		it("should set cookie with sameSite option", async () => {
			await lankaCookies.set("sameKey", "value", {
				sameSite: "strict",
			});
			expect(document.cookie).toContain("sameKey=value");
		});

		it("should set cookie with partitioned flag", async () => {
			await lankaCookies.set("partKey", "value", {
				partitioned: true,
			});
			expect(document.cookie).toContain("partKey=value");
		});

		it("should encode special characters in cookie name and value", async () => {
			await lankaCookies.set("key with spaces", "value=with;special");
			const value = await lankaCookies.get("key with spaces");
			expect(value).toBe("value=with;special");
		});
	});

	describe("getAll", () => {
		it("should return empty object when no cookies exist", async () => {
			const cookies = await lankaCookies.getAll();
			expect(cookies).toEqual({});
		});

		it("should return all cookies", async () => {
			await lankaCookies.set("key1", "value1");
			await lankaCookies.set("key2", "value2");
			await lankaCookies.set("key3", { nested: "object" });

			const cookies = await lankaCookies.getAll();
			expect(cookies).toEqual({
				key1: "value1",
				key2: "value2",
				key3: { nested: "object" },
			});
		});

		it("should parse JSON values correctly", async () => {
			await lankaCookies.set("jsonKey", {
				foo: "bar",
				arr: [1, 2, 3],
			});
			const cookies = await lankaCookies.getAll();
			expect(cookies.jsonKey).toEqual({
				foo: "bar",
				arr: [1, 2, 3],
			});
		});
	});

	describe("has", () => {
		it("should return true if cookie exists", async () => {
			await lankaCookies.set("existingKey", "value");
			const exists = await lankaCookies.has("existingKey");
			expect(exists).toBe(true);
		});

		it("should return false if cookie does not exist", async () => {
			const exists = await lankaCookies.has("nonExistentKey");
			expect(exists).toBe(false);
		});
	});
});
