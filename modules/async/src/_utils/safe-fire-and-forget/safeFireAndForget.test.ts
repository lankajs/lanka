import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { safeFireAndForget } from "./safeFireAndForget";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("safeFireAndForget", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("in development", () => {
		beforeEach(() => {
			createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
		});

		it("prints the failure", async () => {
			const error = new Error("boom");
			safeFireAndForget(Promise.reject(error));
			await flush();
			expect(console.error).toHaveBeenCalledWith(error);
		});

		it("silent on success", async () => {
			safeFireAndForget(Promise.resolve());
			await flush();
			expect(console.error).not.toHaveBeenCalled();
		});
	});

	describe("in production", () => {
		beforeEach(() => {
			createLanka({ host: lankaTestHost, flags: { isDevelopment: false } });
		});

		it("prints nothing: a console message gives the user nothing", async () => {
			safeFireAndForget(Promise.reject(new Error("silent")));
			await flush();
			expect(console.error).not.toHaveBeenCalled();
		});
	});

	it("does not throw synchronously", () => {
		createLanka({ host: lankaTestHost, flags: {} });
		expect(() => {
			safeFireAndForget(Promise.reject(new Error("silent")));
		}).not.toThrow();
	});

	it("works without a bootstrapped framework", async () => {
		// Flags are read tolerantly: a fire-and-forget helper must not itself become
		// a start-up failure before the framework is up.
		safeFireAndForget(Promise.reject(new Error("silent")));
		await flush();
		expect(console.error).not.toHaveBeenCalled();
	});
});
