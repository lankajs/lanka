import { describe, expect, it } from "vitest";
import { getLankaFlags, getLankaHost } from "lanka/config";
import { lankaEventBus } from "lanka/scenario";
import { runLankaRequest } from "./runLankaRequest";
import { lankaServerRuntimeResolver } from "../_internal/lanka-server-runtime-resolver/lankaServerRuntimeResolver";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "lanka";

const request = { host: lankaTestHost };

describe("runLankaRequest", () => {
	it("gives the work a bootstrapped instance and returns what it produced", async () => {
		const answer = await runLankaRequest(request, (lanka) => {
			expect(lanka.isBootstrapped()).toBe(true);
			return "the loader's result";
		});

		expect(answer).toBe("the loader's result");
	});

	it("resolves the ambient facades to THIS request's instance", async () => {
		await runLankaRequest({ ...request, flags: { isMockMode: true } }, () => {
			// `getLankaFlags()` holds no instance and asks which one is active. On a
			// server that question has one right answer per request.
			expect(getLankaFlags().isMockMode).toBe(true);
		});
	});

	// The defect the whole package exists to prevent: two users overlapping in one
	// process, and the second one's framework answering for the first.
	it("KEEPS two overlapping requests apart", async () => {
		const seen: (boolean | undefined)[] = [];

		// Coordinated, not timed. A `setTimeout` long enough on one machine is not
		// long enough on a two-core runner where the other request's bootstrap is
		// still going, and the test then asserts the scheduler rather than the
		// isolation. This gate makes the interleaving the same everywhere: the slow
		// request cannot finish until the fast one has read its own flags.
		let releaseSlow = (): void => undefined;
		const fastHasRead = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});

		const slow = runLankaRequest({ ...request, flags: { isMockMode: true } }, async () => {
			await fastHasRead;
			seen.push(getLankaFlags().isMockMode);
		});
		const fast = runLankaRequest({ ...request, flags: { isMockMode: false } }, () => {
			seen.push(getLankaFlags().isMockMode);
			releaseSlow();
		});

		await Promise.all([fast, slow]);

		expect(seen).toEqual([false, true]);
	});

	it("gives each request its own event bus", async () => {
		const heard: string[] = [];

		await runLankaRequest(request, () => {
			lankaEventBus.subscribe("first-request", () => heard.push("first"));
		});
		await runLankaRequest(request, () => {
			lankaEventBus.dispatch("first-request", undefined);
		});

		expect(heard).toEqual([]);
	});

	it("carries the caller's cookie onto every request, and nothing else", async () => {
		// `host` is the browser's connection to the host framework, not the
		// framework's connection to the API. Forwarding it produces requests that
		// are wrong in ways that take an afternoon to find.
		await runLankaRequest(
			{ ...request, headers: { cookie: "session=abc", host: "example.com" } },
			async (lanka) => {
				expect(await headersSentBy(lanka)).toEqual({ cookie: "session=abc" });
			},
		);
	});

	it("adds no header when the caller passed none", async () => {
		await runLankaRequest(request, async (lanka) => {
			expect(await headersSentBy(lanka)).toBeUndefined();
		});
	});

	it("builds the host from a base URL, the way `startLanka` does", async () => {
		// A server rarely has a host object lying around: it has an environment
		// variable. Both shapes have to arrive at the same instance.
		await runLankaRequest({ apiBaseUrl: "https://api.example.com" }, () => {
			expect(getLankaHost().apiBaseUrl).toBe("https://api.example.com");
		});
	});

	it("installs the plugins before bootstrap, in the order given", async () => {
		const installed: string[] = [];
		const plugin = (name: string) => ({
			name,
			install: () => {
				installed.push(name);
			},
		});

		await runLankaRequest({ ...request, plugins: [plugin("http"), plugin("sse")] }, (lanka) => {
			// Installed BEFORE bootstrap: a plugin adding a bootstrap service after
			// the plan is built adds it to nothing.
			expect(lanka.isBootstrapped()).toBe(true);
		});

		expect(installed).toEqual(["http", "sse"]);
	});

	it("disposes the instance even when the work throws", async () => {
		await expect(
			runLankaRequest(request, () => {
				throw new Error("the loader failed");
			}),
		).rejects.toThrow("the loader failed");

		// Outside the scope there is no instance, which is the point: a leftover one
		// would be the next request reading this one's framework.
		expect(lankaServerRuntimeResolver()).toBeNull();
	});

	it("makes an ambient read outside a scope a named failure", async () => {
		// The resolver is installed by the first call above, so from here on this
		// process answers honestly rather than with the last instance created.
		await runLankaRequest(request, () => undefined);

		expect(() => lankaEventBus.dispatch("anything", undefined)).toThrow(/request scope/);
	});
});

/**
 * What a gateway's request would carry, read off the installed middleware.
 *
 * The instance's `requestMiddleware` is public — it is how a plugin's wrapper is
 * observed — so this asks the framework rather than the package's internals.
 */
const headersSentBy = async (lanka: ILankaInstance): Promise<unknown> => {
	let headers: unknown;

	for (const wrapper of lanka.requestMiddleware) {
		await wrapper({ endpoint: "/x", options: {}, attempt: 1 }, (ctx) => {
			headers = (ctx.options as { headers?: unknown }).headers;
			return Promise.resolve(undefined);
		});
	}

	return headers;
};
