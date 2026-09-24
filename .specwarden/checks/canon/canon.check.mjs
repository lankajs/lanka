/**
 * The canon's executable half: one check per `skills/<rule>/SKILL.md` that has a
 * gate, in the order and with the questions of `skills/gates/SKILL.md` §7.
 *
 * The logic stays in `scripts/check-<subject>.mjs`, where its readers are pure,
 * exported and tested, and where a person runs it directly. This file only puts
 * each one in the list, with the rule it enforces and the sentence that proves
 * it looked: every gate's success line carries a count (§2), and `expect`
 * refuses a zero exit that printed none — a script that crashed into an empty
 * `git ls-files` would otherwise pass by saying nothing.
 */
import { commandCheck } from "specwarden";

/** A count that is not zero: `0 files` is a glob that matched nothing. */
const COUNT = String.raw`[1-9]\d*`;

const GATES = [
	{
		id: "naming",
		owner: "skills/naming/SKILL.md",
		statement: "every directory, file, symbol and config key is called what it is",
		success: `names follow the canon: ${COUNT} files`,
	},
	{
		id: "structure",
		owner: "skills/structure/SKILL.md",
		statement: "every file is where its kind lives, and a barrel holds only what it publishes",
		success: `structure follows the canon: ${COUNT} sources`,
	},
	{
		id: "composition",
		owner: "skills/composition/SKILL.md",
		statement: "the code inside a file is arranged within the budgets, which only fall",
		success: `composition follows the canon: ${COUNT} files`,
	},
	{
		id: "docs",
		owner: "skills/documentation/SKILL.md",
		statement:
			"documentation is in one language, a deprecation instructs, and every package carries its three documents in the shape they all share",
		success: `documentation follows the canon: ${COUNT} files`,
	},
	{
		id: "api",
		owner: "skills/surface/SKILL.md",
		statement: "every published name is written down in `api/` and demonstrated by a scene",
		success: `surface follows the canon: ${COUNT} packages`,
		script: "check-api",
	},
	{
		id: "points",
		owner: "skills/surface/SKILL.md",
		statement: "every extension point has an occupant",
		success: `extension points follow the canon: ${COUNT} points`,
		script: "check-extension-points",
	},
	{
		id: "family",
		owner: "skills/structure/SKILL.md",
		statement: "a family's members publish one surface, differing only in the vendor name",
		success: `the family agrees: one surface, ${COUNT} vendors`,
	},
	{
		id: "runtime",
		owner: "skills/hosts/SKILL.md",
		statement: "every package runs where it says, and needs a UI framework only where it says",
		success: `every package runs where it says: ${COUNT} packages`,
	},
	{
		id: "forms",
		owner: "skills/forms/SKILL.md",
		statement: "every published thing is a class, a factory, a frozen table or a function",
		success: `forms follow the canon: ${COUNT} files`,
	},
	{
		id: "parity",
		owner: "skills/parity/SKILL.md",
		statement: "both styles reach every role, over one implementation",
		success: `both styles reach every role: ${COUNT} roles`,
	},
	{
		id: "playgrounds",
		owner: "_playgrounds/README.md",
		statement:
			"the applications keep making the claims their contract names, and Astro keeps one island per binding",
		success: `the applications still say the same things: ${COUNT} on a contract`,
	},
	{
		id: "llms",
		owner: "skills/documentation/SKILL.md",
		statement:
			"llms.txt and the skill marketplace name only what exists, and a shipped skill teaches only names that are published",
		success: `llms\\.txt names ${COUNT} packages`,
	},
];

export const checks = GATES.map((gate) =>
	commandCheck({
		id: gate.id,
		title: gate.statement,
		tier: "fast",
		cmd: `node scripts/${gate.script ?? `check-${gate.id}`}.mjs`,
		paths: [`scripts/${gate.script ?? `check-${gate.id}`}.mjs`],
		expect: new RegExp(gate.success),
		rule: { id: `canon-${gate.id}`, statement: gate.statement, owner: gate.owner },
		hint: `Read ${gate.owner} before changing the code or the gate: a gate edited to accept the code is a canon edited by accident.`,
		timeoutSec: 120,
	}),
);
