import { describe, expect, it, vi } from "vitest";
import { createLankaLocatorProxy } from "./createLankaLocatorProxy";

type TService = { name: string };

describe("createLankaLocatorProxy", () => {
	it("resolves instances via locator.get with property name", () => {
		const instance: TService = { name: "ok" };
		const locator = {
			get: vi.fn().mockReturnValue(instance),
		};

		const proxy = createLankaLocatorProxy<TService, { fooService: TService }>({
			locator,
		});

		const resolved = proxy.fooService;

		expect(resolved).toBe(instance);
		expect(locator.get).toHaveBeenCalledWith("fooService");
	});

	it("throws on symbol property access", () => {
		const locator = { get: vi.fn() };
		const proxy = createLankaLocatorProxy<TService, Record<string, TService>>({ locator });

		expect(() => (proxy as unknown as Record<symbol, unknown>)[Symbol.iterator]).toThrow(
			"Cannot access with symbol property: Symbol(Symbol.iterator)",
		);
	});

	it("throws for protected properties", () => {
		const locator = { get: vi.fn() };
		const proxy = createLankaLocatorProxy<TService, Record<string, TService>>({
			locator,
			protectedProperties: ["secret"],
			errorPrefix: "Blocked",
		});

		expect(() => (proxy as { secret: TService }).secret).toThrow(
			"Blocked with property: secret",
		);
	});

	it("throws for internal properties starting with underscore", () => {
		const locator = { get: vi.fn() };
		const proxy = createLankaLocatorProxy<TService, Record<string, TService>>({
			locator,
		});

		expect(() => (proxy as { _internal: TService })._internal).toThrow(
			"Cannot access with property: _internal",
		);
	});

	it("throws for constructor and prototype access", () => {
		const locator = { get: vi.fn() };
		const proxy = createLankaLocatorProxy<TService, Record<string, TService>>({ locator });

		expect(() => (proxy as { constructor: TService }).constructor).toThrow(
			"Cannot access with property: constructor",
		);
		expect(() => (proxy as { prototype: TService }).prototype).toThrow(
			"Cannot access with property: prototype",
		);
	});

	it("does not call locator.get for protected or internal properties", () => {
		const locator = { get: vi.fn() };
		const proxy = createLankaLocatorProxy<TService, Record<string, TService>>({
			locator,
			protectedProperties: ["clearCache"],
			errorPrefix: "Blocked",
		});

		expect(() => (proxy as { clearCache: TService }).clearCache).toThrow(
			"Blocked with property: clearCache",
		);
		expect(() => (proxy as { _: TService })._).toThrow("Blocked with property: _");
		expect(locator.get).not.toHaveBeenCalled();
	});
});
