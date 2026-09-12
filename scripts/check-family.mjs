/**
 * Checks that the validator family stays one package, published once per vendor.
 *
 * The promise every member makes is interchangeability: an application swaps one
 * for another by changing which is installed. That only holds while the surfaces
 * differ in exactly one place — the vendor's name — because every other
 * difference is a migration nobody asked for.
 *
 * It was `check-twins.mjs` and compared a hard-coded PAIR. A pair is a special
 * case of a family, and the special case stopped being true the moment a third
 * validator arrived: the gate would have kept comparing zod with valibot and
 * reported success over four packages it never opened. That is the fourth way a
 * check reports success — it looked at the wrong things and found no problems.
 *
 * The reference is the family's first member in the registry. It is not more
 * correct than the others; it is the one everything is stated against, so a
 * difference is reported once rather than N² times.
 *
 * Run: node scripts/check-family.mjs
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { extractExports } from "./check-api.mjs";
import { FAMILIES, familyMembers, pkgDir, pkgName } from "./registry.mjs";

/** A surface with the vendor's name removed, so two of them can be compared. */
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

/**
 * The members of every declared family, as things this gate can compare.
 *
 * Read from the registry rather than listed here: a seventh validator is then a
 * registry line, and the alternative — a list in the gate — is the list that
 * goes stale, since nothing fails when a new package is missing from it.
 */
export const familiesToCheck = () =>
	FAMILIES.map((family) => {
		const all = familyMembers(family.slug);

		return {
			slug: family.slug,
			/*
			 * A HUB binds no vendor: it is the family's own package, and its surface
			 * is deliberately unlike the others'. Comparing it with them would report
			 * every one of its exports as a divergence, and the only way to silence
			 * that is to stop comparing — which is how a gate ends up checking
			 * nothing. It is listed here so the count is honest, and skipped below.
			 */
			hubs: all.filter((p) => p.hub).map((p) => ({ dir: pkgDir(p), name: pkgName(p) })),
			members: all
				.filter((p) => !p.hub)
				.map((p) => ({ dir: pkgDir(p), name: pkgName(p), word: p.vendor })),
		};
	});

const surfaceOf = (member) => ({
	...member,
	exports: extractExports(readFileSync(`${member.dir}/src/index.ts`, "utf8")),
});

const main = () => {
	const problems = [];
	let compared = 0;

	for (const family of familiesToCheck()) {
		const missing = family.members.filter((m) => !m.word);
		for (const member of missing) {
			problems.push(
				`${member.dir} declares no \`vendor\` in the registry, so its surface ` +
					"cannot be compared with the rest of the family.",
			);
		}
		if (missing.length > 0) continue;

		// One package on a shelf is a level that names what its child already names.
		// It is also unfalsifiable here: a family of one agrees with itself.
		if (family.members.length < 2) {
			problems.push(
				`the "${family.slug}" family has ${String(family.members.length)} member(s). ` +
					"A family is two or more packages binding one port; below that the " +
					"folder adds a level and this gate checks nothing.",
			);
			continue;
		}

		const [reference, ...rest] = family.members.map(surfaceOf);

		for (const member of rest) {
			problems.push(...differences(reference, member));
			compared += 1;
		}
	}

	if (problems.length > 0) {
		console.error(
			`THE FAMILY DIVERGES (${String(problems.length)})\n\n` +
				problems.map((p) => `[family-divergence] ${p}`).join("\n\n") +
				"\n\nPackages built the same way make the difference between them the\n" +
				"difference between the LIBRARIES, not between wrapper depths. Add the missing\n" +
				"half, or take the extra one out.\n\nCanon: skills/surface/SKILL.md",
		);
		process.exit(1);
	}

	const hubs = familiesToCheck().reduce((total, family) => total + family.hubs.length, 0);

	console.log(
		`the family agrees: one surface, ${String(compared + FAMILIES.length)} vendors ` +
			`across ${String(FAMILIES.length)} famil${FAMILIES.length === 1 ? "y" : "ies"}` +
			(hubs > 0
				? `, plus ${String(hubs)} hub${hubs === 1 ? "" : "s"} compared with nothing`
				: ""),
	);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
