import { afterEach, describe, expect, it, vi } from "vitest";
import { isWebCryptoAvailable } from "./isWebCryptoAvailable";

/**
 * `crypto.subtle` exists only in a secure context. An application opened over a
 * plain `http://` tunnel during device testing, or inside a WebView with a partial
 * `crypto`, hits every one of these shapes — and `crypto.subtle.digest` on a
 * missing object throws, which used to poison the session-persistence promise for
 * the whole session.
 */
describe("isWebCryptoAvailable", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("is true on a complete implementation", () => {
		vi.stubGlobal("crypto", {
			subtle: {
				digest: () => undefined,
				importKey: () => undefined,
			},
			getRandomValues: () => undefined,
		});

		expect(isWebCryptoAvailable()).toBe(true);
	});

	it("is false when crypto is absent", () => {
		vi.stubGlobal("crypto", undefined);

		expect(isWebCryptoAvailable()).toBe(false);
	});

	it("is false in an insecure context, where subtle is undefined", () => {
		vi.stubGlobal("crypto", { getRandomValues: () => undefined });

		expect(isWebCryptoAvailable()).toBe(false);
	});

	it("is false when subtle is null", () => {
		vi.stubGlobal("crypto", {
			subtle: null,
			getRandomValues: () => undefined,
		});

		expect(isWebCryptoAvailable()).toBe(false);
	});

	it("is false when digest is missing", () => {
		vi.stubGlobal("crypto", {
			subtle: { importKey: () => undefined },
			getRandomValues: () => undefined,
		});

		expect(isWebCryptoAvailable()).toBe(false);
	});

	it("is false when importKey is missing", () => {
		vi.stubGlobal("crypto", {
			subtle: { digest: () => undefined },
			getRandomValues: () => undefined,
		});

		expect(isWebCryptoAvailable()).toBe(false);
	});

	it("is false when getRandomValues is missing (AES-GCM needs an IV)", () => {
		vi.stubGlobal("crypto", {
			subtle: {
				digest: () => undefined,
				importKey: () => undefined,
			},
		});

		expect(isWebCryptoAvailable()).toBe(false);
	});

	it("never throws, even when reading the global throws", () => {
		Object.defineProperty(globalThis, "crypto", {
			get() {
				throw new Error("access denied");
			},
			configurable: true,
		});

		expect(() => isWebCryptoAvailable()).not.toThrow();
		expect(isWebCryptoAvailable()).toBe(false);
	});
});
