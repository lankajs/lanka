/**
 * Reading and writing cookies: availability detection, set/get round-trips,
 * enumeration and presence checks.
 *
 * Removal, key listing, change watching and edge cases:
 * `lankaCookies.mutations.test.ts`.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { LankaCookies, lankaCookies } from "./LankaCookies";
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

describe("LankaCookies — over the Cookie Store API", () => {
	const store = {
		set: vi.fn(() => Promise.resolve()),
		get: vi.fn(() => Promise.resolve(null)),
		getAll: vi.fn(() => Promise.resolve([])),
		delete: vi.fn(() => Promise.resolve()),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(window, "cookieStore", {
			value: store,
			configurable: true,
			writable: true,
		});
	});

	afterEach(() => {
		Reflect.deleteProperty(window, "cookieStore");
	});

	// A `Date` became a timestamp, and the next line read that timestamp as a
	// number of DAYS: an expiry some fifty million years out, which the store
	// refused or clamped — either way not the date the caller passed.
	it("passes a Date expiry on as that date", async () => {
		const expires = new Date(Date.now() + 86_400_000);

		await new LankaCookies().set("k", "v", { expires });

		expect(store.set).toHaveBeenCalledWith(
			expect.objectContaining({ name: "k", value: "v", expires: expires.getTime() }),
		);
	});

	it("turns a number of days into a timestamp from now", async () => {
		const before = Date.now();

		await new LankaCookies().set("k", "v", { expires: 1 });

		const sent = (store.set.mock.calls[0] as unknown as [{ expires: number }])[0].expires;
		expect(sent).toBeGreaterThanOrEqual(before + 86_400_000);
		expect(sent).toBeLessThanOrEqual(Date.now() + 86_400_000);
	});
});

describe("LankaCookies — cookies this code never wrote", () => {
	afterEach(() => {
		for (const name of ["foreign", "mine"]) {
			document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
		}
	});

	// `document.cookie` holds every cookie on the origin. One set by a server or
	// a sibling with a stray `%` made `decodeURIComponent` throw, and every read
	// on the page threw with it — over a cookie the application never asked for.
	it("reads past a value that is not valid percent-encoding", async () => {
		document.cookie = "foreign=%E0%A4%A";
		await lankaCookies.set("mine", "value");

		await expect(lankaCookies.get("mine")).resolves.toBe("value");
		await expect(lankaCookies.getAll()).resolves.toMatchObject({
			foreign: "%E0%A4%A",
			mine: "value",
		});
	});
});

describe("LankaCookies — what comes back is what went in", () => {
	afterEach(() => {
		for (const name of ["orderNo", "flag", "word", "shape", "list"]) {
			document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
		}
	});

	// `set` takes `string | object` and writes JSON for an object and the string
	// itself for everything else. `get` used to JSON-parse whatever it found, so a
	// string that happens to look like a number came back as one — and the type
	// says `get<T = string>`, so the type was a lie as well.
	it("gives a numeric string back as a string, digits intact", async () => {
		await lankaCookies.set("orderNo", "1234567890123456789");

		// Parsed as a number this loses its last digits, silently, and the order
		// number the user reads is not the one the server issued.
		await expect(lankaCookies.get("orderNo")).resolves.toBe("1234567890123456789");
	});

	it("gives a boolean-looking string back as a string", async () => {
		await lankaCookies.set("flag", "true");

		await expect(lankaCookies.get("flag")).resolves.toBe("true");
	});

	it("does not turn the word `null` into a missing cookie", async () => {
		// The worst of the three: `has` asks whether `get` answered null, so a
		// cookie whose value is the text "null" reported itself as absent.
		await lankaCookies.set("word", "null");

		await expect(lankaCookies.get("word")).resolves.toBe("null");
		await expect(lankaCookies.has("word")).resolves.toBe(true);
	});

	it("still round-trips an object", async () => {
		await lankaCookies.set("shape", { foo: "bar", nested: { count: 2 } });

		await expect(lankaCookies.get("shape")).resolves.toEqual({
			foo: "bar",
			nested: { count: 2 },
		});
	});

	it("still round-trips an array", async () => {
		await lankaCookies.set("list", [1, 2, "three"]);

		await expect(lankaCookies.get("list")).resolves.toEqual([1, 2, "three"]);
	});
});
