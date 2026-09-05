import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { ALankaGateway } from "./ALankaGateway";
import type { ILankaRequest } from "../../_interfaces/ILankaRequest";
import type { TLankaRequestInit } from "../../_types/TLankaRequestInit";
import { lankaStandardValidator } from "../../../validation/lanka-standard-validator/lankaStandardValidator";
import type {
	ILankaValidator,
	TLankaSchema,
} from "../../../validation/lanka-standard-validator/lankaStandardValidator";

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
		_options?: TLankaRequestInit,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		this.calls.push(endpoint);
		if (mockHandler) return mockHandler();
		return Promise.resolve({ endpoint } as TReturn);
	}
}

class ThingGateway extends ALankaGateway {
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

/** A schema that accepts anything: the validator, not the schema, is the subject. */
const anySchema: TLankaSchema<unknown> = {
	"~standard": { version: 1, vendor: "test", validate: (value) => ({ value }) },
};

class ValidatingGateway extends ALankaGateway<RequestInit> {
	constructor(validationService?: ILankaValidator) {
		super({ request: new BridgeRequest(), validationService });
	}

	validator(): ILankaValidator {
		return this.validationService;
	}

	check(body: unknown): unknown {
		return this.validationService.validate(anySchema, body, "things.check");
	}
}

describe("the gateway's validator", () => {
	beforeEach(() => {
		resetActiveLanka();
		createLanka({ host: lankaTestHost }).activate();
	});

	// The config accepted `validationService` and the base read it nowhere: a
	// test double handed to the gateway was silently replaced by the real
	// validator, with nothing to say the option had been ignored.
	it("is the one the config supplied", () => {
		const asked: string[] = [];
		const own: ILankaValidator = {
			validate: (_schema, data, context) => {
				asked.push(context);
				return data as never;
			},
			validateSafe: (_schema, data) => ({ success: true, data: data as never }),
		};

		new ValidatingGateway(own).check({ id: 1 });

		expect(asked).toEqual(["things.check"]);
	});

	it("is the Standard Schema port when the config says nothing", () => {
		expect(new ValidatingGateway().validator()).toBe(lankaStandardValidator);
	});
});
