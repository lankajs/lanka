/**
 * Generated output against its source. Both halves of one rule — "a generated
 * file is edited through its generator" (`rules.mjs`) — and both exist for the
 * same reason: a hand edit reads as correct until the next regeneration
 * silently reverts it.
 */
import { commandCheck, defineCheck } from "specwarden";

import { MIRROR, SOURCE, mirrorOf } from "../../../scripts/check-router-mirror.mjs";

export const checks = [
	/**
	 * In the list, not only in `release`: a stale version stamp in a shipped
	 * skill passed every other check once (plugin-prefetch 2.0.1 said 2.0.0 in
	 * its own skill), because drift ran only there.
	 *
	 * The scaffolder is run and the working tree compared, so this one WRITES:
	 * it is exclusive, and it refuses a dirty tree rather than report someone's
	 * uncommitted edit as drift — `pnpm check` runs on a commit, which is clean.
	 */
	commandCheck({
		id: "drift",
		title: "every generated manifest, config, README and skill matches the registry",
		tier: "fast",
		cmd: "node scripts/check-scaffold-drift.mjs",
		paths: ["scripts/check-scaffold-drift.mjs", "scripts/scaffold.mjs"],
		expect: /registry and generated output agree: generated for [1-9]\d* packages/,
		exclusive: true,
		timeoutSec: 180,
		hint: "Edit `scripts/registry.mjs` and run `pnpm scaffold`. A direct edit to a generated file does not survive the next run.",
	}),

	/**
	 * In-process rather than spawned: the whole rule is one comparison, and
	 * reading both files through the file port is what lets `--fix` repair it —
	 * the correct content is derivable, never chosen.
	 */
	defineCheck({
		id: "router",
		title: "CLAUDE.md is AGENTS.md plus the header saying where it came from",
		tier: "fast",
		when: { ending: [SOURCE, MIRROR, "scripts/check-router-mirror.mjs"] },
		corpus: {
			atLeast: 1,
			why: `${SOURCE} was not readable — the mirror was compared with nothing.`,
		},
		hint: `Put the change in ${SOURCE}, then \`specwarden check router --fix\` or \`pnpm check:router:write\`.`,
		run: (ctx) => {
			const source = ctx.files.tryRead(SOURCE);
			if (source === undefined) return { findings: [], examined: 0, unit: "router" };
			const drifted = ctx.files.tryRead(MIRROR) !== mirrorOf(source);
			return {
				findings: drifted
					? [
							{
								severity: "error",
								file: MIRROR,
								message: `${MIRROR} is not ${SOURCE} plus its header. A rule that exists in two files exists in one of them wrongly, eventually.`,
							},
						]
					: [],
				examined: 1,
				unit: "router",
			};
		},
		fix: (ctx) => {
			ctx.writer.write(MIRROR, mirrorOf(ctx.files.read(SOURCE)));
			return { fixed: 1, summary: `${MIRROR} written from ${SOURCE}` };
		},
	}),
];
