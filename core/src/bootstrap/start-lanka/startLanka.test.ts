import { afterEach, describe, expect, it, vi } from "vitest";
import { startLanka } from "./startLanka";
import { resetActiveLanka } from "../reset-active-lanka/resetActiveLanka";
import { getLankaHost } from "../../config/get-lanka-host/getLankaHost";
import { getLankaFlags } from "../../config/get-lanka-flags/getLankaFlags";
import type { ILankaPlugin } from "../ILankaPlugin";

describe("startLanka", () => {
	afterEach(() => {
		resetActiveLanka();
	});

	it("starts with no configuration at all", async () => {
		const lanka = await startLanka();

		expect(lanka.isBootstrapped()).toBe(true);
		expect(getLankaHost().apiBaseUrl).toBe("");
	});

	it("returns an instance that is already bootstrapped", async () => {
		const lanka = await startLanka({ apiBaseUrl: "https://api.test" });

		expect(lanka.isBootstrapped()).toBe(true);
	});

	it("activates it, so the ambient facades resolve", async () => {
		await startLanka({ apiBaseUrl: "https://api.test" });

		expect(getLankaHost().apiBaseUrl).toBe("https://api.test");
	});

	it("builds the host from a base URL, with English copy", async () => {
		await startLanka({ apiBaseUrl: "/api" });

		expect(getLankaHost().networkErrorMessage()).toBe("Network error");
	});

	it("takes one message without the other two", async () => {
		await startLanka({
			apiBaseUrl: "/api",
			messages: { networkErrorMessage: () => "no connection" },
		});

		expect(getLankaHost().networkErrorMessage()).toBe("no connection");
		expect(getLankaHost().timeoutErrorMessage()).toBe("Request timed out");
	});

	it("takes a whole host instead", async () => {
		await startLanka({
			host: {
				apiBaseUrl: "https://own.test",
				httpErrorMessage: () => "own",
				networkErrorMessage: () => "own",
				timeoutErrorMessage: () => "own",
			},
		});

		expect(getLankaHost().apiBaseUrl).toBe("https://own.test");
	});

	it("passes flags through", async () => {
		await startLanka({ apiBaseUrl: "/api", flags: { isMockMode: true } });

		expect(getLankaFlags().isMockMode).toBe(true);
	});

	it("runs the services it was given", async () => {
		const init = vi.fn();

		await startLanka({ apiBaseUrl: "/api", services: [{ name: "one", init }] });

		expect(init).toHaveBeenCalledTimes(1);
	});

	// The order this function exists to get right: a plugin that adds a bootstrap
	// service after the plan is built adds it to nothing.
	it("installs plugins BEFORE bootstrap", async () => {
		const order: string[] = [];
		const plugin: ILankaPlugin = {
			name: "order",
			install: () => {
				order.push("installed");
			},
		};

		await startLanka({
			apiBaseUrl: "/api",
			plugins: [plugin],
			services: [
				{
					name: "service",
					init: () => {
						order.push("service");
					},
				},
			],
		});

		expect(order).toEqual(["installed", "service"]);
	});

	it("installs plugins in the order given", async () => {
		const order: string[] = [];
		const named = (name: string): ILankaPlugin => ({
			name,
			install: () => {
				order.push(name);
			},
		});

		await startLanka({ apiBaseUrl: "/api", plugins: [named("first"), named("second")] });

		expect(order).toEqual(["first", "second"]);
	});

	it("hands back the same instance, with everything it always had", async () => {
		const lanka = await startLanka({ apiBaseUrl: "/api" });

		expect(typeof lanka.createScope).toBe("function");
		expect(typeof lanka.useRequestMiddleware).toBe("function");
		lanka.dispose();
	});
});
