import { describe, expect, it } from "vitest";
import { isTypeOnlyImport } from "./isTypeOnlyImport";

describe("isTypeOnlyImport", () => {
	it("`import type { X }` is type-only", () => {
		expect(isTypeOnlyImport({ source: { value: "@Gateways/X" }, importKind: "type" })).toBe(
			true,
		);
	});

	it("every specifier marked `type` is type-only", () => {
		expect(
			isTypeOnlyImport({
				source: { value: "@Gateways/X" },
				importKind: "value",
				specifiers: [{ importKind: "type" }, { importKind: "type" }],
			}),
		).toBe(true);
	});

	it("one value specifier makes the import a value import", () => {
		expect(
			isTypeOnlyImport({
				source: { value: "@Gateways/X" },
				importKind: "value",
				specifiers: [{ importKind: "type" }, { importKind: "value" }],
			}),
		).toBe(false);
	});

	it("under espree nothing is type-only — the syntax does not exist there", () => {
		expect(isTypeOnlyImport({ source: { value: "@Gateways/X" } })).toBe(false);
		expect(isTypeOnlyImport({ source: { value: "@Gateways/X" }, specifiers: [] })).toBe(false);
	});
});
