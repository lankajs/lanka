/**
 * Checks that `@lankajs/zod` and `@lankajs/valibot` stay the same package twice.
 *
 * The promise both make is interchangeability: an application swaps one for the
 * other by changing which is installed. That only holds while the two surfaces
 * differ in exactly one place — the vendor's name — because every other
 * difference is a migration nobody asked for.
 *
 * A check rather than a note in a TODO, which is what it was: "keep the shape
 * identical" is a wish until something fails when it stops being true.
 *
 * Run: node scripts/check-twins.mjs
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { extractExports } from "./check-api.mjs";

/** The two packages, and the word that is allowed to differ. */
export const TWINS = {
	a: { dir: "modules/zod", word: "Zod" },
	b: { dir: "modules/valibot", word: "Valibot" },
};

/** A surface with the vendor's name removed, so the two can be compared. */
export const anonymise = (names, word) =>
	names
		.map((entry) => ({ ...entry, name: entry.name.replace(word, "") }))
		.sort((x, y) => x.name.localeCompare(y.name));

export const differences = (a, b) => {
	const left = anonymise(a.exports, a.word);
	const right = anonymise(b.exports, b.word);
	const problems = [];

	for (const entry of left.filter(
		(x) => !right.some((y) => y.name === x.name && y.kind === x.kind),
	)) {
		problems.push(`${a.dir} exports ${entry.kind} \`${entry.name}\` and ${b.dir} does not.`);
	}
	for (const entry of right.filter(
		(y) => !left.some((x) => x.name === y.name && x.kind === y.kind),
	)) {
		problems.push(`${b.dir} exports ${entry.kind} \`${entry.name}\` and ${a.dir} does not.`);
	}

	return problems;
};

const surfaceOf = (twin) => ({
	...twin,
	exports: extractExports(readFileSync(`${twin.dir}/src/index.ts`, "utf8")),
});

const main = () => {
	const problems = differences(surfaceOf(TWINS.a), surfaceOf(TWINS.b));

	if (problems.length > 0) {
		console.error(
			`THE TWIN PACKAGES DIVERGE (${String(problems.length)})\n\n` +
				problems.map((p) => `[twin-divergence] ${p}`).join("\n\n") +
				"\n\nTwo packages built the same way make the difference between them the\n" +
				"difference between the LIBRARIES, not between wrapper depths. Add the missing\n" +
				"half, or take the extra one out.\n\nCanon: skills/surface/SKILL.md",
		);
		process.exit(1);
	}

	console.log("the twin packages agree: one surface, two vendors");
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
