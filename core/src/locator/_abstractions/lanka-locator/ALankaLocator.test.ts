import { describe, expect, it, vi } from "vitest";
import { ALankaLocator } from "./ALankaLocator";

class FooService {}
class BarService {}

class TestLocator extends ALankaLocator<unknown> {
	constructor(config: {
		findClassByName: (name: string) => (new () => unknown) | undefined;
		createInstance?: (Class: new () => unknown) => unknown;
		// `unknown` already includes undefined — `unknown | undefined` collapses
		// to `unknown` and reads as if it said something.
		getInstanceByName?: (name: string) => unknown;
		notFoundError?: (name: string, propertyName: string) => string;
	}) {
		super(config);
	}
}

describe("ALankaLocator", () => {
	it("resolves instance by camelCase property and caches it", () => {
		const locator = new TestLocator({
			findClassByName: (name) => {
				if (name === "FooService") return FooService;
				return undefined;
			},
		});

		const first = locator.get("fooService");
		const second = locator.get("fooService");

		expect(first).toBeInstanceOf(FooService);
		expect(second).toBe(first);
	});

	it("uses custom getInstanceByName before findClassByName", () => {
		const customInstance = new FooService();
		const getInstanceByName = vi.fn((name: string) => {
			if (name === "FooService") return customInstance;
			return undefined;
		});
		const findClassByName = vi.fn(() => FooService);

		const locator = new TestLocator({
			findClassByName,
			getInstanceByName,
		});

		const resolved = locator.get("fooService");

		expect(resolved).toBe(customInstance);
		expect(getInstanceByName).toHaveBeenCalledWith("FooService");
		expect(findClassByName).not.toHaveBeenCalled();
	});

	it("caches instances resolved by getInstanceByName", () => {
		const customInstance = new FooService();
		const getInstanceByName = vi.fn(() => customInstance);
		const findClassByName = vi.fn(() => FooService);

		const locator = new TestLocator({
			findClassByName,
			getInstanceByName,
		});

		const first = locator.get("fooService");
		const second = locator.get("fooService");

		expect(first).toBe(customInstance);
		expect(second).toBe(customInstance);
		expect(getInstanceByName).toHaveBeenCalledTimes(1);
		expect(findClassByName).not.toHaveBeenCalled();
	});

	it("falls back to findClassByName when getInstanceByName returns undefined", () => {
		const getInstanceByName = vi.fn(() => undefined);
		const findClassByName = vi.fn((name: string) =>
			name === "BarService" ? BarService : undefined,
		);

		const locator = new TestLocator({
			findClassByName,
			getInstanceByName,
		});

		const resolved = locator.get("barService");

		expect(resolved).toBeInstanceOf(BarService);
		expect(getInstanceByName).toHaveBeenCalledWith("BarService");
		expect(findClassByName).toHaveBeenCalledWith("BarService");
	});

	it("uses custom createInstance when provided", () => {
		const createInstance = vi.fn((Class: new () => unknown) => new Class());
		const locator = new TestLocator({
			findClassByName: (name) => (name === "BarService" ? BarService : undefined),
			createInstance,
		});

		const resolved = locator.get("barService");

		expect(resolved).toBeInstanceOf(BarService);
		expect(createInstance).toHaveBeenCalledTimes(1);
	});

	it("throws custom notFoundError when instance is missing", () => {
		const locator = new TestLocator({
			findClassByName: () => undefined,
			notFoundError: (name, prop) => `Missing ${name} for ${prop}`,
		});

		expect(() => locator.get("missingService")).toThrow(
			"Missing MissingService for missingService",
		);
	});

	it("uses default notFoundError when none is provided", () => {
		const locator = new TestLocator({
			findClassByName: () => undefined,
		});

		expect(() => locator.get("missingService")).toThrow(
			'Instance "MissingService" (accessed as "missingService") not found.',
		);
	});

	it("resolves PascalCase property names without changing the class name", () => {
		const locator = new TestLocator({
			findClassByName: (name) => (name === "FooService" ? FooService : undefined),
		});

		const resolved = locator.get("FooService");

		expect(resolved).toBeInstanceOf(FooService);
	});

	it("clearCache removes cached instances", () => {
		const locator = new TestLocator({
			findClassByName: (name) => (name === "FooService" ? FooService : undefined),
		});

		const first = locator.get("fooService");
		locator.clearCache();
		const second = locator.get("fooService");

		expect(second).toBeInstanceOf(FooService);
		expect(second).not.toBe(first);
	});
});

describe("a config forwarded with fields left undefined", () => {
	// The defect: the defaults were spread FIRST and the config over them, so a
	// caller passing its own optional config — `createInstance: maybeUndefined` —
	// removed the only thing that can construct an instance, and resolution died
	// with "createInstance is not a function" nowhere near the cause.
	it("falls back to the default constructor rather than losing it", () => {
		const locator = new TestLocator({
			findClassByName: (name) => (name === "FooService" ? FooService : undefined),
			createInstance: undefined,
		});

		expect(locator.get("fooService")).toBeInstanceOf(FooService);
	});

	it("falls back to the default not-found message", () => {
		const locator = new TestLocator({
			findClassByName: () => undefined,
			notFoundError: undefined,
		});

		expect(() => locator.get("missingService")).toThrow(/not found/);
	});
});
