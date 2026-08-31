/**
 * Pins `check-twins.mjs`: what counts as the two packages drifting apart.
 *
 * The comparison is the subject, so it is driven directly. Running the script
 * against today's two barrels would only prove today's answer.
 */
import { describe, expect, it } from "vitest";
import { anonymise, differences, TWINS } from "./check-twins.mjs";

const twin = (dir, word, names) => ({ dir, word, exports: names });

describe("comparing two vendors of one surface", () => {
	it("says nothing when the only difference is the vendor's name", () => {
		const a = twin("modules/zod", "Zod", [{ name: "lankaZodValidator", kind: "value" }]);
		const b = twin("modules/valibot", "Valibot", [
			{ name: "lankaValibotValidator", kind: "value" },
		]);

		expect(differences(a, b)).toEqual([]);
	});

	it("names a capability one of them has and the other does not", () => {
		const a = twin("modules/zod", "Zod", [
			{ name: "lankaZodValidator", kind: "value" },
			{ name: "lankaZodLazy", kind: "value" },
		]);
		const b = twin("modules/valibot", "Valibot", [
			{ name: "lankaValibotValidator", kind: "value" },
		]);

		const found = differences(a, b);

		// An application that swapped the package would lose a function it calls.
		expect(found).toHaveLength(1);
		expect(found[0]).toContain("lankaLazy");
	});

	it("counts a value and a type of one name as different things", () => {
		const a = twin("modules/zod", "Zod", [{ name: "TLankaInferred", kind: "type" }]);
		const b = twin("modules/valibot", "Valibot", [{ name: "TLankaInferred", kind: "value" }]);

		expect(differences(a, b)).not.toEqual([]);
	});

	it("removes the vendor's name wherever it sits in the identifier", () => {
		expect(anonymise([{ name: "lankaZodValidator", kind: "value" }], "Zod")).toEqual([
			{ name: "lankaValidator", kind: "value" },
		]);
	});

	it("watches the two packages that made the promise", () => {
		expect([TWINS.a.dir, TWINS.b.dir]).toEqual(["modules/zod", "modules/valibot"]);
	});
});
