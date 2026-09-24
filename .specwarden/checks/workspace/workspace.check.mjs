/**
 * The toolchain, run as checks: everything whose logic is somebody else's program.
 *
 * Each command carries `expect` or `refuse` wherever a zero exit would not prove
 * it did anything (`skills/gates/SKILL.md` §6). `pnpm --filter` in particular
 * reports a filter that matched no package as success, so a renamed folder and a
 * passing typecheck look identical from the exit code alone.
 */
import { commandCheck } from "specwarden";

/** pnpm's sentence for an empty selection, which it exits 0 on. */
const NO_PACKAGE_MATCHED = [
	{
		pattern: /No projects matched the filters/i,
		why: "the filter selected no package, and pnpm reports an empty set of work as success.",
	},
];

/** A filtered run names how many packages it selected; zero is refused above. */
const SELECTED = /Scope: [1-9]\d* of \d+ workspace projects/;

/** A suite that ran nothing prints no totals, and vitest exits 0 on no test files. */
const TESTS_PASSED = /Tests\s+[1-9]\d* passed/;

export const checks = [
	/**
	 * First in intent: CI installs before anything else, and that step was once
	 * the only one nothing local could see — a package was renamed and nothing
	 * here re-read the lockfile. `--lockfile-only` touches no node_modules.
	 */
	commandCheck({
		id: "lockfile",
		title: "the committed lockfile satisfies every manifest, as CI installs it",
		tier: "fast",
		cmd: "pnpm install --frozen-lockfile --lockfile-only",
		when: { ending: ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"] },
		expect: /Scope: all [1-9]\d* workspace projects/,
		timeoutSec: 120,
		rule: {
			id: "the-lockfile-is-what-ci-installs",
			statement:
				"the committed lockfile satisfies every manifest, so a local install and CI resolve one tree",
			owner: "CONTRIBUTING.md",
		},
		hint: "Run `pnpm install` and commit the lockfile.",
	}),

	commandCheck({
		id: "lint",
		title: "one lint configuration over every package, with no warning let through",
		tier: "heavy",
		// Through the script, which carries the raised heap and says why.
		cmd: "pnpm run lint",
		timeoutSec: 900,
		rule: {
			id: "lint-is-clean",
			statement:
				"nothing merges while ESLint or Prettier reports anything, warnings included",
			owner: "CONTRIBUTING.md",
		},
		hint: "Run `pnpm lint:fix`. The import restrictions are not style: `rules.mjs` names what they hold.",
	}),

	commandCheck({
		id: "typecheck",
		title: "the workspace program typechecks",
		tier: "heavy",
		cmd: "pnpm run typecheck",
		timeoutSec: 900,
		rule: {
			id: "the-workspace-typechecks",
			statement: "the root program — every package and its tests — typechecks",
			owner: "skills/typescript/SKILL.md",
		},
	}),

	/**
	 * Not folded into `typecheck`: each binding's program resolves its own UI
	 * framework, and five frameworks' JSX and DOM declarations collide in one.
	 */
	commandCheck({
		id: "bindings",
		title: "every binding typechecks in its own program",
		tier: "heavy",
		cmd: 'pnpm --filter "./modules/bindings/*" run typecheck',
		refuse: NO_PACKAGE_MATCHED,
		expect: SELECTED,
		timeoutSec: 900,
		rule: {
			id: "every-binding-typechecks-alone",
			statement:
				"every binding typechecks against its own UI framework, apart from the others",
			owner: "skills/typescript/SKILL.md",
		},
	}),

	/**
	 * The playground applications, each in its OWN program: a device
	 * application's types and a browser application's collide in one — React
	 * Native redeclares half the DOM's fetch surface — and the only honest way to
	 * check both is to check them apart.
	 */
	commandCheck({
		id: "apps",
		title: "every playground application typechecks in its own program",
		tier: "heavy",
		cmd: 'pnpm -r --filter "./_playgrounds/**" run typecheck',
		refuse: NO_PACKAGE_MATCHED,
		expect: SELECTED,
		timeoutSec: 900,
		rule: {
			id: "every-application-typechecks-alone",
			statement: "every playground application typechecks in its own program",
			owner: "_playgrounds/README.md",
		},
	}),

	/**
	 * `test:coverage`, never bare `test`: each package's threshold is a ratchet,
	 * and this is the one place it is turned. Sequential, and the script says why.
	 */
	commandCheck({
		id: "coverage",
		title: "every package's suite passes, above its coverage ratchet",
		tier: "heavy",
		cmd: "pnpm run test:coverage",
		refuse: NO_PACKAGE_MATCHED,
		expect: TESTS_PASSED,
		exclusive: true,
		timeoutSec: 1800,
		rule: {
			id: "every-package-proves-itself",
			statement:
				"every package's suite passes, and covers at least what its threshold records",
			owner: "skills/testing/SKILL.md",
		},
	}),

	/**
	 * The guard scripts are not workspace packages, so `pnpm -r` never reaches
	 * them — which is how a gate ends up the only untested code in a repository
	 * built on gates.
	 */
	commandCheck({
		id: "scripts",
		title: "every guard script's spec passes",
		tier: "heavy",
		cmd: "pnpm run test:scripts",
		expect: TESTS_PASSED,
		timeoutSec: 600,
		rule: {
			id: "a-gate-is-seen-to-fail",
			statement: "every gate ships a spec that makes it fail, and the spec passes",
			owner: "skills/gates/SKILL.md",
		},
	}),
];
