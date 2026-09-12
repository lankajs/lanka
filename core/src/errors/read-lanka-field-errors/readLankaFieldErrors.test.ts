import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { readLankaFieldErrors } from "./readLankaFieldErrors";
import { LankaError } from "../lanka-error/LankaError";
import { lankaStandardValidator } from "../../validation/lanka-standard-validator/lankaStandardValidator";

/**
 * The one read a ViewModel makes before deciding whether a failure belongs to a
 * form. Always a list, never a throw: the caller writes `for … of` and nothing
 * else.
 */
describe("readLankaFieldErrors", () => {
	it("answers the fields a LankaError carries", () => {
		const fields = [{ path: ["email"], message: "taken" }];
		const error = new LankaError({ kind: "http", message: "no", status: 422, fields });

		expect(readLankaFieldErrors(error)).toBe(fields);
	});

	it("answers an empty list for a LankaError without fields", () => {
		expect(readLankaFieldErrors(new LankaError({ kind: "network", message: "down" }))).toEqual(
			[],
		);
	});

	it("answers an empty list for a foreign error, and never throws", () => {
		expect(readLankaFieldErrors(new Error("boom"))).toEqual([]);
		expect(readLankaFieldErrors(undefined)).toEqual([]);
		expect(readLankaFieldErrors("nope")).toEqual([]);
	});

	it("the empty answer is one frozen list, shared by every caller", () => {
		const first = readLankaFieldErrors(new Error("a"));
		const second = readLankaFieldErrors(undefined);

		// A caller that pushes into it finds out here, not in another screen.
		expect(Object.isFrozen(first)).toBe(true);
		expect(first).toBe(second);
	});

	it("reads what the validation port throws — the seam the whole feature exists for", () => {
		const schema = v.object({ items: v.array(v.object({ qty: v.number() })) });
		const thrown = (() => {
			try {
				lankaStandardValidator.validate(
					schema,
					{ items: [{ qty: 1 }, { qty: "x" }] },
					"order",
				);
				return null;
			} catch (error) {
				return error;
			}
		})();

		expect(readLankaFieldErrors(thrown)).toEqual([
			{ path: ["items", 1, "qty"], message: expect.any(String) },
		]);
	});
});
