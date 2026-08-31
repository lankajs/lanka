/**
 * Keeps `CLAUDE.md` a copy of `AGENTS.md` rather than a second opinion.
 *
 * ## Why a generated mirror and not a pointer
 *
 * `CLAUDE.md` is loaded into every session automatically; `AGENTS.md` is read
 * when somebody chooses to. A one-line pointer therefore puts the rules one
 * decision away from the reader who needs them most, and a hand-written second
 * copy drifts — the repository this convention came from had the two disagree by
 * hundreds of lines before the copy was generated.
 *
 * So `CLAUDE.md` is `AGENTS.md` with a header saying where it came from, and this
 * gate fails when it is anything else. There is no second wording to maintain and
 * no way for the two to say different things.
 *
 * Run: node scripts/check-router-mirror.mjs [--write]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SOURCE = "AGENTS.md";
export const MIRROR = "CLAUDE.md";

/** The header that says this file is not the one to edit. */
export const HEADER = [
	"<!-- GENERATED FILE — DO NOT EDIT.",
	"     `CLAUDE.md` is `AGENTS.md` plus this header, written by",
	"     `node scripts/check-router-mirror.mjs --write`.",
	"     Edit AGENTS.md; the `check:router` gate reverts anything written here. -->",
	"",
].join("\n");

/** What the mirror must contain, given the source. */
export const mirrorOf = (source) => `${HEADER}${source}`;

const main = () => {
	const write = process.argv.includes("--write");
	const source = readFileSync(SOURCE, "utf8");
	const expected = mirrorOf(source);

	if (write) {
		writeFileSync(MIRROR, expected, "utf8");
		console.log(`${MIRROR} written from ${SOURCE}`);
		return;
	}

	const actual = existsSync(MIRROR) ? readFileSync(MIRROR, "utf8") : null;
	if (actual === expected) {
		console.log(`the router has one wording: ${MIRROR} matches ${SOURCE}`);
		return;
	}

	console.error(
		`THE ROUTER HAS TWO WORDINGS (1)\n\n` +
			`[router-drift] ${MIRROR}\n` +
			`    is not ${SOURCE} plus its header. A rule that exists in two files exists\n` +
			`    in one of them wrongly, eventually. Put the change in ${SOURCE} and run\n` +
			`    \`node scripts/check-router-mirror.mjs --write\`.\n\n` +
			"Canon: AGENTS.md",
	);
	process.exit(1);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
