/**
 * The whole list, and only what the tree cannot say for itself.
 *
 * Every `*.check.mjs` under `checks/` is found without being named here. What a
 * check runs is in its file; what it enforces is on the check or in `rules.mjs`;
 * why the list exists at all is `skills/gates/SKILL.md` §1.
 */
import { defineConfig } from "specwarden";

import { rules } from "./rules.mjs";

export default defineConfig({
	rules,

	/**
	 * `fast` reads files and answers the same on any machine; `heavy` compiles,
	 * tests or builds, and costs minutes. `pnpm check` runs both, fast first, so
	 * a canon divergence is reported before the suites start.
	 *
	 * There is no third tier for `check:perf`, and that is the point: a tier is
	 * something `check --all` runs, and a benchmark on a busy machine reports
	 * everything regressed. It stays a script, judged where somebody chose to
	 * measure — `rules.mjs` records why.
	 */
	tiers: ["fast", "heavy"],

	/**
	 * A change to one of these makes every check relevant, whatever else the
	 * diff touched.
	 */
	sharedBuildInputs: [
		{
			prefix: "scripts/registry.mjs",
			why: "every generated manifest, config, README and skill derives from it",
		},
		{
			prefix: "pnpm-lock.yaml",
			why: "what is installed decides what every other check measured",
		},
		{ prefix: "pnpm-workspace.yaml", why: "which directories are packages at all" },
		{
			prefix: "package.json",
			why: "the root manifest holds the toolchain every check runs on",
		},
		{ prefix: "tsconfig.base.json", why: "every package's program extends it" },
		{ prefix: ".specwarden/", why: "the list itself changed" },
	],
});
