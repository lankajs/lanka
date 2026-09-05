import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "../../../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaFetchRequest } from "../../lanka-fetch-request/LankaFetchRequest";
import { LankaFetchJsonRequest } from "../../lanka-fetch-json-request/LankaFetchJsonRequest";
import type { ILankaTransport } from "../../../_interfaces/ILankaTransport";

/**
 * The template every fetch request shares.
 *
 * Asserted across both kinds together: the sequence used to be copied into each
 * of them, and copies drift. The one that mattered here was refusal — one kind
 * returned the error handler's result while the other threw regardless.
 */
const KINDS = [
	["LankaFetchRequest", (config: object) => new LankaFetchRequest(config)],
	["LankaFetchJsonRequest", (config: object) => new LankaFetchJsonRequest(config)],
] as const;

const transportAnswering = (response: Response): ILankaTransport<RequestInit> => ({
	request: vi.fn(() => Promise.resolve(response)),
});

describe("the fetch request template", () => {
	beforeEach(() => {
		resetActiveLanka();
		createLanka({ host: lankaTestHost }).activate();
	});

	describe.each(KINDS)("%s", (_name, make) => {
		it("refuses an unsuccessful response even when the handler breaks its contract", async () => {
			// `TLankaErrorHandler` is typed `Promise<never>`. A handler that returns
			// anyway must not hand that back as if the request had succeeded: a
			// non-value never becomes a value.
			const brokenHandler = vi.fn(() => Promise.resolve(undefined as never));
			const request = make({
				transport: transportAnswering(new Response("nope", { status: 500 })),
				errorHandler: brokenHandler,
			});

			await expect(request.execute("/api")).rejects.toThrow();
			expect(brokenHandler).toHaveBeenCalledOnce();
		});

		it("prefers the mock handler over the transport in mock mode", async () => {
			const transport = transportAnswering(new Response("{}", { status: 200 }));
			const request = make({ transport, useMock: true });

			const value = await request.execute("/api", undefined, () => Promise.resolve("mocked"));

			expect(value).toBe("mocked");
			expect(transport.request).not.toHaveBeenCalled();
		});

		it("sends through the transport when there is no mock handler", async () => {
			const transport = transportAnswering(new Response("{}", { status: 200 }));
			const request = make({ transport, useMock: true });

			await request.execute("/api");

			expect(transport.request).toHaveBeenCalledOnce();
		});
	});
});
