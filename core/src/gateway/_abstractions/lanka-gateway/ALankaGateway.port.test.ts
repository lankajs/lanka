import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { ALankaGateway } from "./ALankaGateway";
import type { ILankaRequest } from "../../_interfaces/ILankaRequest";

/**
 * The extension point: a gateway takes a REQUEST PORT, not our class.
 *
 * Asserted with an implementation that inherits nothing from the framework. If
 * this file stops compiling because `ALankaGateway` demands `ALankaRequest`
 * again, extending the framework has quietly become a dependency on its
 * implementation rather than on its contract.
 */
class BridgeRequest implements ILankaRequest {
	public readonly calls: string[] = [];

	execute<TReturn = Response>(
		endpoint: string,
		_options?: RequestInit,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		this.calls.push(endpoint);
		if (mockHandler) return mockHandler();
		return Promise.resolve({ endpoint } as TReturn);
	}
}

class ThingGateway extends ALankaGateway<RequestInit> {
	constructor(request: ILankaRequest) {
		super({ request, basePath: "/things" });
	}

	getThing(id: string): Promise<{ endpoint: string }> {
		return this.requestExecutor.execute<{ endpoint: string }>(this.endpoint(id));
	}
}

describe("the gateway's request port", () => {
	beforeEach(() => {
		resetActiveLanka();
		createLanka({ host: lankaTestHost }).activate();
	});

	it("accepts an implementation that extends nothing of ours", async () => {
		const request = new BridgeRequest();
		const gateway = new ThingGateway(request);

		const value = await gateway.getThing("7");

		// The host base URL is prepended by `endpoint()`; the port sees the finished
		// address, which is the whole point of it being the last layer.
		expect(value.endpoint).toBe(`${lankaTestHost.apiBaseUrl}/things/7`);
		expect(request.calls).toEqual([`${lankaTestHost.apiBaseUrl}/things/7`]);
	});

	it("passes the mock handler through, so mock mode is the port's business too", async () => {
		const request = new BridgeRequest();
		const mockHandler = vi.fn(() => Promise.resolve({ endpoint: "mocked" }));

		const value = await request.execute("/things/7", undefined, mockHandler);

		expect(value).toEqual({ endpoint: "mocked" });
		expect(mockHandler).toHaveBeenCalledOnce();
	});
});
