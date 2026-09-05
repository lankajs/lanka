import { beforeEach, describe, expect, it } from "vitest";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { resetActiveLanka } from "../../../bootstrap/reset-active-lanka/resetActiveLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaGateway } from "./createLankaGateway";
import { lankaStandardValidator } from "../../../validation/lanka-standard-validator/lankaStandardValidator";
import type { ILankaValidator } from "../../../validation/lanka-standard-validator/lankaStandardValidator";

/**
 * The functional style receives what the class style can reach — the parity
 * contract, member for member. `validationService` was the member missing from
 * BOTH sides while the config accepted it: handed in, read by nothing.
 */
describe("createLankaGateway — the context", () => {
	beforeEach(() => {
		resetActiveLanka();
		createLanka({ host: lankaTestHost }).activate();
	});

	it("carries the validator the config supplied", () => {
		const own: ILankaValidator = {
			validate: (_schema, data) => data as never,
			validateSafe: (_schema, data) => ({ success: true, data: data as never }),
		};

		const gateway = createLankaGateway({
			validationService: own,
			methods: ({ validationService }) => ({ validator: () => validationService }),
		});

		expect(gateway.validator()).toBe(own);
	});

	it("carries the Standard Schema port when the config says nothing", () => {
		const gateway = createLankaGateway({
			methods: ({ validationService }) => ({ validator: () => validationService }),
		});

		expect(gateway.validator()).toBe(lankaStandardValidator);
	});
});
