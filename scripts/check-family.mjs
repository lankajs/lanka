/**
 * Checks that a family stays one surface, published once per vendor.
 *
 * The promise every member makes is interchangeability: an application swaps one
 * for another by changing which is installed. That only holds while the surfaces
 * differ in exactly one place — the vendor's name — because every other
 * difference is a migration nobody asked for.
 *
 * Four questions, and only the first needs two members:
 *
 * 1. do the members' surfaces differ in nothing but the vendor's name;
 * 2. does each surface carry that name at all — a package that is not
 *    vendor-bound is on the shelf for no reason;
 * 3. does the shelf hold only what the registry declares;
 * 4. does every member RUN the conformance suite its family names.
 *
 * The last is what lets a shelf hold ONE package: the member is held to a list
 * written independently of it, and the kit's double is the port's second
 * implementation. `skills/structure/SKILL.md` 5d owns that rule.
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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { extractExports } from "./check-api.mjs";
import { FAMILIES, KINDS, PACKAGES, familyMembers, pkgDir, pkgName } from "./registry.mjs";

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
			/** The shelf itself, so the gate can ask what is standing on it. */
			dir: `${KINDS[family.kind].dir}/${family.slug}`,
			/**
			 * The suite every member answers, when the port has one.
			 *
			 * It is what makes a shelf of ONE legal: the member is then held to a list
			 * written independently of it rather than to a sibling, and the kit's
			 * double is the port's second implementation. Absent, two members are
			 * required — a family of one agrees with itself.
			 */
			conformance: family.conformance,
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

/**
 * Does the vendor's name appear in what this package publishes?
 *
 * The question a shelf of one still has to answer. If anonymising a member's
 * surface changes nothing, the package is not vendor-bound — and a package that
 * is not vendor-bound has no business on a shelf, whatever the count.
 */
const namesItsVendor = (member) => member.exports.some((entry) => entry.name.includes(member.word));

/** Every source file inside a package, so the gate can ask what it calls. */
const sourcesOf = (dir) =>
	existsSync(dir)
		? readdirSync(dir, { recursive: true, encoding: "utf8" })
				.filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
				.filter((name) => !name.includes("node_modules") && !name.startsWith("dist"))
		: [];

/** Does this package actually RUN the suite its family names? */
const runsTheSuite = (dir, suite) =>
	sourcesOf(dir).some((name) => {
		const path = join(dir, name);
		return statSync(path).isFile() && readFileSync(path, "utf8").includes(suite);
	});

/**
 * Does this shelf still need a second package to be worth a level?
 *
 * The rule a count used to stand in for. One member is enough when the port has
 * a suite: the member is then held to a list written independently of it, and
 * the kit's double is the second implementation, so "implementable twice" is
 * proved with one vendor published. With no suite there is nothing to hold it
 * to, and a shelf of one agrees with itself.
 */
export const needsASibling = (family) =>
	family.members.length < 2 && family.conformance === undefined;

/** The subpaths the test kit publishes, which is where a conformance suite lives. */
export const publishedSuites = () =>
	new Set(
		(PACKAGES.find((p) => p.kind === "tool" && p.slug === "testing")?.entries ?? []).map(
			(entry) => (typeof entry === "string" ? entry : entry.name),
		),
	);

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

		// An empty shelf is a level with nothing under it, and no suite rescues it.
		if (family.members.length === 0) {
			problems.push(
				`the "${family.slug}" family has no members. A shelf with nothing on it ` +
					"is a level that names nothing; take it out of the registry until a " +
					"package binds its port.",
			);
			continue;
		}

		const surfaces = family.members.map(surfaceOf);

		// Asked of every member, whatever the count: a package whose surface does not
		// name its vendor is not vendor-bound, and a shelf of those is a grouping
		// folder wearing a family's name.
		for (const member of surfaces.filter((one) => !namesItsVendor(one))) {
			problems.push(
				`${member.dir} publishes nothing carrying "${member.word}". A member's ` +
					"surface differs from its siblings' in exactly one place — the vendor's " +
					"name — so a surface without it is not a binding of this port.",
			);
		}

		// A shelf holds packages, and the registry says which. A directory standing on
		// one that the registry does not name is a shelf silently becoming a package:
		// pnpm globs it, the scaffolder does not, and the disagreement surfaces as a
		// package nobody builds.
		const declared = new Set(
			[...family.members, ...family.hubs].map((one) => one.dir.slice(family.dir.length + 1)),
		);
		const standing = existsSync(family.dir)
			? readdirSync(family.dir).filter((name) =>
					statSync(join(family.dir, name)).isDirectory(),
				)
			: [];

		for (const name of standing.filter((one) => !declared.has(one))) {
			problems.push(
				`${family.dir}/${name} stands on the "${family.slug}" shelf and no ` +
					"registry entry names it. Declare it in `scripts/registry.mjs`, or take " +
					"it off the shelf.",
			);
		}

		if (family.conformance === undefined) {
			if (needsASibling(family)) {
				problems.push(
					`the "${family.slug}" family has one member and names no conformance ` +
						"suite. One package on a shelf is a level that names what its child " +
						"already names — unless the port it binds has a suite the member " +
						"answers, which holds it to a list rather than to a sibling. Add " +
						"`conformance` to its registry entry, or add the second member.",
				);
			}
		} else {
			if (!publishedSuites().has(family.conformance)) {
				problems.push(
					`the "${family.slug}" family names "${family.conformance}" as its ` +
						"conformance suite, and the test kit publishes no such entry. A suite " +
						"nobody can import is a suite nobody runs.",
				);
			}

			for (const member of family.members.filter(
				(one) => !runsTheSuite(one.dir, family.conformance),
			)) {
				problems.push(
					`${member.dir} never calls ${family.conformance}. The suite is what says ` +
						"a member keeps the port's promises; one that does not run it is on " +
						"the shelf on its own word.",
				);
			}
		}

		const [reference, ...rest] = surfaces;

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
