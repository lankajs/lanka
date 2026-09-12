/**
 * Pins `check-family.mjs`: what counts as the family drifting apart.
 *
 * The comparison is the subject, so it is driven directly. Running the script
 * against today's barrels would only prove today's answer.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { anonymise, differences, familiesToCheck } from "./check-family.mjs";

const member = (dir, word, names) => ({ dir, word, exports: names });

describe("comparing two vendors of one surface", () => {
	it("says nothing when the only difference is the vendor's name", () => {
		const a = member("modules/validators/zod", "Zod", [
			{ name: "lankaZodValidator", kind: "value" },
		]);
		const b = member("modules/validators/valibot", "Valibot", [
			{ name: "lankaValibotValidator", kind: "value" },
		]);

		expect(differences(a, b)).toEqual([]);
	});

	it("names a capability one of them has and the other does not", () => {
		const a = member("modules/validators/zod", "Zod", [
			{ name: "lankaZodValidator", kind: "value" },
			{ name: "lankaZodLazy", kind: "value" },
		]);
		const b = member("modules/validators/valibot", "Valibot", [
			{ name: "lankaValibotValidator", kind: "value" },
		]);

		const found = differences(a, b);

		// An application that swapped the package would lose a function it calls.
		expect(found).toHaveLength(1);
		expect(found[0]).toContain("lankaLazy");
	});

	it("counts a value and a type of one name as different things", () => {
		const a = member("modules/validators/zod", "Zod", [
			{ name: "TLankaInferred", kind: "type" },
		]);
		const b = member("modules/validators/valibot", "Valibot", [
			{ name: "TLankaInferred", kind: "value" },
		]);

		expect(differences(a, b)).not.toEqual([]);
	});

	it("removes the vendor's name wherever it sits in the identifier", () => {
		expect(anonymise([{ name: "lankaZodValidator", kind: "value" }], "Zod")).toEqual([
			{ name: "lankaValidator", kind: "value" },
		]);
	});
});

describe("who the gate watches", () => {
	/**
	 * The list comes from the registry, and this is what stops it going stale: a
	 * validator added to `modules/validators/` and forgotten in `FAMILIES` was
	 * previously invisible to a gate that still reported success.
	 */
	it("reads its members from the registry rather than a list of its own", () => {
		const [validators] = familiesToCheck();

		expect(validators.slug).toBe("validators");
		expect(validators.members.map((m) => m.dir)).toContain("modules/validators/zod");
		expect(validators.members.map((m) => m.dir)).toContain("modules/validators/valibot");
	});

	it("gives every member a vendor word, since a surface cannot be anonymised without one", () => {
		for (const family of familiesToCheck()) {
			for (const m of family.members) expect(m.word, m.dir).toBeTruthy();
		}
	});

	it("compares every member of the family, not only the first two", () => {
		for (const family of familiesToCheck()) {
			expect(family.members.length, family.slug).toBeGreaterThanOrEqual(2);
		}
	});
});

describe("the gate itself, run as a process", () => {
	/**
	 * A guard nothing exercises is a guard that reports success.
	 *
	 * `differences` is unit-tested above, and a unit-tested comparison inside a
	 * script that never calls it would still pass every run. So these spawn the
	 * real script against a temporary tree whose barrels it reads, and assert the
	 * exit code and the tag — which are what a contributor acts on.
	 *
	 * The tree carries the REAL slugs, because the script reads its member list
	 * from the registry. That is the point of reading it from there: a fixture
	 * cannot drift from the family it is a fixture for.
	 */
	const SCRIPT = resolve("scripts/check-family.mjs");

	let root = null;

	const treeOf = (barrels) => {
		root = mkdtempSync(join(tmpdir(), "lanka-check-family-"));

		for (const family of familiesToCheck()) {
			for (const member of family.members) {
				const path = join(root, member.dir, "src", "index.ts");
				mkdirSync(dirname(path), { recursive: true });
				writeFileSync(path, barrels[member.dir] ?? defaultBarrel(member.word), "utf8");
			}
		}

		return root;
	};

	const defaultBarrel = (word) =>
		`export { lanka${word}Validator } from "./x";\nexport type { TLankaInferred } from "./y";\n`;

	const run = () => {
		try {
			return {
				code: 0,
				output: execFileSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" }),
			};
		} catch (error) {
			return { code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
		}
	};

	afterEach(() => {
		if (root) rmSync(root, { recursive: true, force: true });
		root = null;
	});

	it("passes a family whose surfaces differ only in the vendor's name", () => {
		treeOf({});

		const result = run();

		expect(result.code).toBe(0);
		expect(result.output).toContain("the family agrees");
	});

	it("FAILS when one member publishes a name the others do not", () => {
		// The divergence that matters: an application swapping packages would lose
		// a function it calls.
		treeOf({
			"modules/validators/yup":
				'export { lankaYupValidator } from "./x";\n' +
				'export { lankaYupRetry } from "./z";\n' +
				'export type { TLankaInferred } from "./y";\n',
		});

		const result = run();

		expect(result.code).toBe(1);
		expect(result.output).toContain("[family-divergence]");
		expect(result.output).toContain("lankaRetry");
	});

	it("FAILS when a member is missing a name the reference publishes", () => {
		treeOf({
			"modules/validators/typebox": 'export { lankaTypeBoxValidator } from "./x";\n',
		});

		const result = run();

		expect(result.code).toBe(1);
		expect(result.output).toContain("TLankaInferred");
	});

	it("counts what it compared, so a gate that opened nothing cannot look green", () => {
		// "the family agrees" over zero comparisons is the fourth way a check
		// reports success. The count is the only thing that tells the two apart.
		treeOf({});

		expect(run().output).toMatch(/\d+ vendors/);
	});

	it("says the hub was compared with nothing, rather than quietly skipping it", () => {
		// A member excluded silently is a member nobody remembers is excluded.
		treeOf({});

		expect(run().output).toContain("hub");
	});
});
