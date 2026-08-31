/**
 * Pins `check-llms.mjs`: what makes the machine-readable half wrong.
 *
 * The readers are driven with text and a fake presence check, because the subject
 * is the reading. Run against the real repository the spec could only prove
 * today's answer — the one state in which the gate passes.
 */
import { describe, expect, it } from "vitest";
import {
	indexDivergences,
	skillDivergences,
	marketplaceDivergences,
	staleIndex,
	versionDivergences,
} from "./check-llms.mjs";

const link = (path) =>
	`- [${path}](https://raw.githubusercontent.com/lankajs/lanka/refs/heads/main/${path})`;

describe("the index a model fetches", () => {
	it("names a link that is not in the repository", () => {
		// A model follows the link and gets a 404 — worse than an absent line,
		// because the absent one sends it to the next source.
		const problems = indexDivergences(link("core/GONE.md"), () => false);

		expect(problems.some((problem) => problem.tag === "llms-dead-link")).toBe(true);
	});

	it("says nothing about a link that resolves", () => {
		const problems = indexDivergences(link("core/GUIDE.md"), () => true).filter(
			(problem) => problem.tag === "llms-dead-link",
		);

		expect(problems).toEqual([]);
	});

	it("names a package the index forgot", () => {
		const problems = indexDivergences("", () => true);

		expect(problems.some((problem) => problem.tag === "llms-package-missing")).toBe(true);
	});

	it("names a version the index does not claim", () => {
		expect(versionDivergences("Version 0.0.1, 19 packages.", "1.0.0")).toHaveLength(1);
	});

	it("accepts the version it does claim", () => {
		expect(versionDivergences("Version 1.0.0, 19 packages.", "1.0.0")).toEqual([]);
	});

	it("reports an index the generator would write differently", () => {
		// The index is generated, so a hand edit is a second truth: the version, the
		// package list and every link come from the registry.
		expect(staleIndex("what is on disk", "what the generator writes")).toHaveLength(1);
	});
});

describe("the marketplace `/plugin marketplace add` reads", () => {
	const manifest = (plugins) => ({ name: "lanka", plugins });

	it("names an entry whose directory has no plugin manifest", () => {
		const problems = marketplaceDivergences(
			manifest([{ name: "lanka-core", source: "./core" }]),
			(path) => !path.endsWith("plugin.json"),
		);

		expect(problems.some((problem) => problem.tag === "marketplace-no-manifest")).toBe(true);
	});

	it("names an entry that ships no skills", () => {
		const problems = marketplaceDivergences(
			manifest([{ name: "lanka-core", source: "./core" }]),
			(path) => !path.endsWith("skills"),
		);

		expect(problems.some((problem) => problem.tag === "marketplace-no-skills")).toBe(true);
	});

	it("names the same plugin listed twice", () => {
		const problems = marketplaceDivergences(
			manifest([
				{ name: "lanka-core", source: "./core" },
				{ name: "lanka-core", source: "./core" },
			]),
			() => true,
		);

		expect(problems.some((problem) => problem.tag === "marketplace-duplicate")).toBe(true);
	});

	it("names a package nobody can install", () => {
		const problems = marketplaceDivergences(manifest([]), () => true);

		expect(problems.some((problem) => problem.tag === "marketplace-package-missing")).toBe(
			true,
		);
	});
});

describe("what a shipped skill teaches", () => {
	const skill = (text) => [{ file: "core/skills/lanka-core/SKILL.md", text }];
	const published = new Set(["createLankaVM", "startLanka"]);

	it("names an example that teaches an API nobody publishes", () => {
		// The failure mode this exists for: an agent loads the skill, writes code
		// that looks idiomatic, and the consumer's build fails on a name that was
		// never there. Worse than no skill, because the reader trusted it.
		const problems = skillDivergences(
			skill("```ts\nconst vm = createLankaImaginaryVM({});\n```"),
			published,
		);

		expect(problems).toHaveLength(1);
		expect(problems[0].tag).toBe("skill-teaches-unknown-name");
	});

	it("accepts an example built from names that exist", () => {
		expect(
			skillDivergences(skill("```ts\nconst vm = createLankaVM({});\n```"), published),
		).toEqual([]);
	});

	it("reads only fenced blocks, because prose is not copied", () => {
		// Prose says `ALankaX` to mean "any role" and names things in neighbouring
		// packages. A snippet is what somebody pastes.
		expect(
			skillDivergences(skill("Every role is `ALankaX` plus `createLankaX`."), published),
		).toEqual([]);
	});

	it("says nothing about the package, the scope or the alias", () => {
		const imports = '```ts\nimport { startLanka } from "lanka";\nimport "@lankajs/host";\n```';

		expect(skillDivergences(skill(imports), published)).toEqual([]);
	});
});
