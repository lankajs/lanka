/**
 * The rules no single check states.
 *
 * A rule held by exactly one check is written ON that check, beside the command
 * that proves it. What stays here is what can live nowhere else: a rule several
 * checks share, and a rule nothing in the list can hold — which is allowed when
 * it says why, and never as an apology.
 *
 * The statements are `AGENTS.md`'s "Rules that hold everywhere", worded as it
 * words them; the router owns the reasoning.
 */
export const rules = [
	{
		id: "generated-files-are-edited-through-their-generator",
		statement:
			"a generated file is changed by changing its registry or script and regenerating, never by hand",
		owner: "AGENTS.md",
		enforcement: { enforcedBy: ["drift", "router"] },
	},
	{
		id: "core-knows-nothing-of-modules-and-plugins",
		statement:
			"core imports no module and no plugin, and no plugin imports another plugin — what two share belongs in core, behind an extension point",
		owner: "AGENTS.md",
		enforcement: { enforcedBy: ["lint"] },
	},
	{
		id: "nothing-imports-from-a-consuming-application",
		statement:
			"the framework imports nothing from a consuming application; the only inward direction is `@lanka_di/*`",
		owner: "AGENTS.md",
		enforcement: { enforcedBy: ["lint"] },
	},
	{
		id: "a-published-name-is-never-removed",
		statement: "a name in a barrel is kept until a major version",
		owner: "skills/surface/SKILL.md",
		enforcement: {
			notMechanizable:
				"`api` makes a removal a visible diff in `api/*.api.md`, which is as far as a reading goes: whether that diff is a major version is a decision, and no check can tell a mistake from one that was taken.",
		},
	},
	{
		id: "a-ratchet-only-tightens",
		statement:
			"coverage thresholds and perf baselines move toward stricter, and carry the measurement they came from",
		owner: "skills/gates/SKILL.md",
		enforcement: {
			notMechanizable:
				"a threshold moved by hand is a number in a diff, and a raised floor looks exactly like a corrected one. The reviewer reads the measurement in the comment above it; nothing here can.",
		},
	},
	{
		id: "a-hot-path-holds-its-baseline",
		statement: "no hot path gets dearer than its recorded baseline, relative to its yardstick",
		owner: "skills/performance/SKILL.md",
		enforcement: {
			notMechanizable:
				"it is held by `pnpm run check:perf`, which is outside this list on purpose: every check here answers the same on any machine, and a benchmark on a busy laptop or a two-core runner reports everything regressed, controls included. It is judged on an idle machine; CI prints the ratios without judging them — `skills/gates/SKILL.md` §1.",
		},
	},
];
