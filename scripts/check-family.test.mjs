/**
 * Pins `check-family.mjs`: what counts as the family drifting apart.
 *
 * The comparison is the subject, so it is driven directly. Running the script
 * against today's barrels would only prove today's answer.
 */
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	anonymise,
	differences,
	familiesToCheck,
	needsASibling,
	publishedSuites,
} from "./check-family.mjs";

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

	/**
	 * Was `members.length >= 2`, until a shelf was allowed to hold one.
	 *
	 * The count was never the property worth having: what a shelf promises is that
	 * its members are interchangeable, and two members agreeing with each other is
	 * weaker evidence than one member answering a list written independently of it.
	 * So the rule became a choice — a sibling to be compared with, or a suite to be
	 * held to — and this is that rule, not the count it replaced.
	 */
	it("gives every family either a second member or a conformance suite", () => {
		for (const family of familiesToCheck()) {
			expect(
				family.members.length >= 2 || typeof family.conformance === "string",
				family.slug,
			).toBe(true);
		}
	});

	it("names a suite the test kit actually publishes", () => {
		for (const family of familiesToCheck().filter((one) => one.conformance)) {
			expect(publishedSuites(), family.slug).toContain(family.conformance);
		}
	});
});

describe("when one package is enough for a shelf", () => {
	const shelf = (members, conformance) => ({
		members: Array.from({ length: members }, (_, i) => ({ dir: `modules/x/${String(i)}` })),
		conformance,
	});

	it("refuses one package on a shelf with no suite to hold it to", () => {
		expect(needsASibling(shelf(1, undefined))).toBe(true);
	});

	it("accepts one package whose port has a suite", () => {
		// The member is compared with a list written before it existed, and the
		// kit's double is the second implementation of the port.
		expect(needsASibling(shelf(1, "lankaStorageAdapterConformance"))).toBe(false);
	});

	it("accepts two packages whether or not a suite exists", () => {
		expect(needsASibling(shelf(2, undefined))).toBe(false);
		expect(needsASibling(shelf(2, "lankaReadCacheConformance"))).toBe(false);
	});
});

describe("a shelf that can grow", () => {
	/**
	 * What "add a fifth validator" cost, asserted for every family there is.
	 *
	 * The validator family went from two packages to seven and the query family
	 * from one to two, and neither growth touched a gate: the members come from
	 * the registry, so a new one is a directory and a line. These are the two
	 * properties that keep it that way, and they are checked against the real
	 * tree rather than a fixture — a fixture would go on agreeing after the tree
	 * stopped.
	 */
	it("finds every family's members through the registry, under the shelf they belong to", () => {
		for (const family of familiesToCheck()) {
			expect(family.members.length, family.slug).toBeGreaterThan(0);

			for (const member of [...family.members, ...family.hubs]) {
				expect(member.dir.startsWith(`${family.dir}/`), member.dir).toBe(true);
			}
		}
	});

	it("holds exactly what the registry declares, so nothing can arrive unnoticed", () => {
		for (const family of familiesToCheck()) {
			const declared = [...family.members, ...family.hubs]
				.map((one) => one.dir.slice(family.dir.length + 1))
				.sort();
			const standing = readdirSync(family.dir)
				.filter((name) => statSync(`${family.dir}/${name}`).isDirectory())
				.sort();

			expect(standing, family.slug).toEqual(declared);
		}
	});

	it("gives every shelf a workspace glob, so a new member needs no pnpm edit", () => {
		// The one file that is NOT read from the registry, and the one a growing
		// family would otherwise forget: a package pnpm does not glob is a package
		// nothing installs, and every gate downstream reports success over it.
		const workspace = readFileSync("pnpm-workspace.yaml", "utf8");

		for (const family of familiesToCheck()) {
			expect(workspace, family.slug).toContain(`"${family.dir}/*"`);
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

				// Every member answers its family's suite, so the tree passes for the
				// reason a real member does. A case that wants the opposite deletes
				// this file rather than the harness leaving it out for everybody.
				if (family.conformance) {
					const scenes = join(root, member.dir, "_playground");
					mkdirSync(scenes, { recursive: true });
					writeFileSync(
						join(scenes, "playground.test.ts"),
						`${family.conformance}({ vendor: "x" });\n`,
						"utf8",
					);
				}
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

	it("FAILS when a member never runs the suite its family names", () => {
		// The promise the shelf is built on. A member that does not answer the list
		// is on the shelf on its own word, and the word of a package is what the
		// suite exists to replace.
		treeOf({});
		rmSync(join(root, "modules/validators/yup/_playground"), { recursive: true, force: true });

		const result = run();

		expect(result.code).toBe(1);
		expect(result.output).toContain("never calls lankaValidatorConformance");
	});

	it("FAILS when a directory stands on the shelf that the registry does not name", () => {
		treeOf({});
		mkdirSync(join(root, "modules/validators/superstruct/src"), { recursive: true });

		const result = run();

		expect(result.code).toBe(1);
		expect(result.output).toContain("superstruct");
		expect(result.output).toContain("no registry entry names it");
	});

	it("FAILS when a member publishes nothing carrying its vendor's name", () => {
		// Anonymising this surface changes nothing, which means the package is not
		// vendor-bound — and a shelf of packages like that is a grouping folder.
		treeOf({
			"modules/validators/arktype":
				'export { lankaValidator } from "./x";\nexport type { TLankaInferred } from "./y";\n',
		});

		const result = run();

		expect(result.code).toBe(1);
		expect(result.output).toContain("publishes nothing carrying");
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
