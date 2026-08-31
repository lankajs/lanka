/**
 * Measures the hot paths and refuses a regression against the recorded baseline.
 *
 * The canon is `skills/performance/SKILL.md`; this is its executable half.
 *
 * ## Why a ratio and not a millisecond
 *
 * `27,212,092 ops/sec` is a fact about one machine on one afternoon. Recorded as
 * a baseline it produces a check that fails for reasons nobody caused, and a
 * check that cries wolf stops being read. Every bench file therefore measures one
 * yardstick of its own — a plain property read, registered by
 * `lankaBenchCalibration()` — and what is recorded is how many of those one call
 * costs. That number survives a DIFFERENT machine, because a slower CPU scales
 * the yardstick with it.
 *
 * ## What the ratio does NOT survive: a CONTENDED machine
 *
 * This file used to claim it survived "a parallel run" too. The first CI run of
 * this repository disproved that on a two-core shared runner: three unrelated
 * operations — proxy tracking in core, a ring buffer in the devtools panel and
 * the request chain in the http plugin — came out 1.69×, 2.05× and 2.14× dearer
 * than recorded, while the code they measure had not been touched. A yardstick
 * that is one property read is nearly free and hard to slow down; the operations
 * around it hold caches and allocate, so contention does not scale the two
 * together and the ratio inflates.
 *
 * So a flagged regression is MEASURED TWICE before it is reported. Two runs of an
 * unchanged bench agree to a few percent; a machine doing something else does not
 * agree with itself. What survives the second measurement is reported as a
 * regression, and what does not is named as the instrument — which is what
 * `skills/performance/SKILL.md` §3 tells a person to do by hand, done by the
 * gate instead of asked of them.
 *
 * ## What the tolerance means
 *
 * A ratio between two operations in one process holds to a few percent. The
 * tolerance here is 1.6×, which is not caution but the division of labour: this
 * gate exists to catch "it became three times dearer", and a gate that also fires
 * on "it became four percent dearer" is a gate that gets switched off.
 *
 * ## Why this is NOT in `pnpm check`
 *
 * Every other gate reads files: the same tree gives the same answer on any
 * machine, which is what makes "a local green equals a remote green" true. This
 * one measures, and a measurement needs an instrument. The chain runs wherever it
 * is invoked — a laptop mid-build, a two-core shared runner — and on such a
 * machine everything regresses together, including the benches written to
 * BYPASS the framework. Twenty operations across eight packages did exactly that
 * here, twice in a row, while the tree stood still.
 *
 * So the judgment happens where somebody chose to measure: `pnpm run check:perf`
 * on an idle machine, which is also where `--write` records a baseline. CI runs
 * `--report`, which prints every ratio and exits zero — the numbers stay visible
 * to a reader, and nothing pretends a build server can hold a stopwatch.
 *
 * Run: node scripts/check-perf.mjs [--write | --report]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** The yardstick every bench file registers first. Mirrors `@lankajs/tool-testing`. */
export const CALIBRATION_NAME = "calibration: a plain property read";

/**
 * How far a ratio may drift before it is a regression.
 *
 * Measured: two consecutive runs of an unchanged bench give ratios within ~3% of
 * each other, and a run under parallel load within ~15%. 1.6× sits far above the
 * noise and far below anything a person would call "still fine".
 */
export const TOLERANCE = 1.6;

/** Where a package's baseline lives. */
export const baselinePath = (pkg) => `perf/${pkg.replace(/^.*\//, "")}.perf.md`;

/**
 * The cost of every operation in a run, in units of its own file's yardstick.
 *
 * Grouped by file rather than by package: vitest gives each bench file its own
 * worker, so a yardstick from another file is a yardstick from another process.
 */
export const ratiosOf = (report) => {
	const rows = [];

	for (const file of report.files ?? []) {
		for (const group of file.groups ?? []) {
			const benchmarks = group.benchmarks ?? [];
			const calibration = benchmarks.find((entry) => entry.name === CALIBRATION_NAME);
			if (!calibration) continue;

			for (const entry of benchmarks) {
				if (entry.name === CALIBRATION_NAME) continue;

				rows.push({
					group: group.fullName.replace(/^.*?([\w./-]+\.bench\.tsx?) > /, "$1 > "),
					name: entry.name,
					// How many yardstick calls this one call costs.
					ratio: calibration.hz / entry.hz,
					hz: entry.hz,
					rme: entry.rme,
				});
			}
		}
	}

	return rows.sort((a, b) => `${a.group}${a.name}`.localeCompare(`${b.group}${b.name}`));
};

/** Bench files whose group registered no yardstick. */
export const uncalibrated = (report) =>
	(report.files ?? []).flatMap((file) =>
		(file.groups ?? [])
			.filter((group) => !(group.benchmarks ?? []).some((e) => e.name === CALIBRATION_NAME))
			.map((group) => group.fullName),
	);

/** The baseline as it is written to disk. */
export const renderBaseline = (pkg, rows) => {
	const lines = [
		`# ${pkg}`,
		"",
		"Generated by `scripts/check-perf.mjs`. Do not edit by hand; run",
		"`node scripts/check-perf.mjs --write` and read the diff — a number that moved",
		"is the review.",
		"",
		"`× yardstick` is what one call costs in plain property reads, measured in the",
		"same process. It is the only column compared: `hz` is this machine on the day",
		"it was recorded, kept for a sense of scale and nothing else.",
		"",
	];

	let group = null;
	for (const row of rows) {
		if (row.group !== group) {
			group = row.group;
			if (lines[lines.length - 1] !== "") lines.push("");
			lines.push(
				`## ${group}`,
				"",
				"| Operation | × yardstick | hz | ±rme |",
				"| --- | --- | --- | --- |",
			);
		}

		lines.push(
			`| ${row.name} | ${row.ratio.toFixed(2)} | ` +
				`${Math.round(row.hz).toLocaleString("en-US")} | ${row.rme.toFixed(2)}% |`,
		);
	}

	if (rows.length === 0) lines.push("_Nothing measured._");

	return lines.join("\n") + "\n";
};

/** The recorded ratios, by group and name. */
export const readBaseline = (text) => {
	const recorded = new Map();
	let group = null;

	for (const line of text.split("\n")) {
		const heading = /^## (.+)$/.exec(line);
		if (heading) {
			group = heading[1];
			continue;
		}

		// Tolerant of padding: prettier aligns a markdown table into columns, and a
		// name read as `"one call   "` matches nothing measured — which would report
		// every row as stale the first time somebody ran the formatter.
		const row = /^\|([^|]+)\|([^|]+)\|/.exec(line);
		const ratio = row ? Number(row[2].trim()) : Number.NaN;

		if (group && row && !Number.isNaN(ratio))
			recorded.set(`${group} :: ${row[1].trim()}`, ratio);
	}

	return recorded;
};

/** What moved, and by how much. */
export const compare = (recorded, rows, tolerance = TOLERANCE) => {
	const problems = [];
	const seen = new Set();

	for (const row of rows) {
		const key = `${row.group} :: ${row.name}`;
		seen.add(key);

		const before = recorded.get(key);
		if (before === undefined) {
			problems.push({
				tag: "perf-report-stale",
				where: key,
				detail:
					"measured now and absent from the baseline. Run " +
					"`node scripts/check-perf.mjs --write` and read the diff.",
			});
			continue;
		}

		if (row.ratio <= before * tolerance) continue;

		problems.push({
			tag: "perf-regressed",
			where: key,
			detail:
				`${before.toFixed(2)} → ${row.ratio.toFixed(2)} yardsticks per call, ` +
				`past the ${String(tolerance)}× tolerance. Either the change is worth it — ` +
				"record it with `--write` and let the diff say so — or it is the one this " +
				"gate exists to catch.",
		});
	}

	for (const key of recorded.keys()) {
		if (seen.has(key)) continue;

		problems.push({
			tag: "perf-report-stale",
			where: key,
			detail:
				"in the baseline and measured by nothing. A bench that stopped running " +
				"is a number nobody is holding to.",
		});
	}

	return problems;
};

/**
 * The regressions that a second measurement agrees with.
 *
 * Only `perf-regressed` is re-read: a stale baseline row and a missing yardstick
 * are facts about the files, and a second run cannot change its mind about
 * those.
 *
 * A regression this gate exists to catch — something 1.6× dearer — reproduces;
 * an idle-vs-busy artefact does not. Reporting the unconfirmed ones separately
 * matters as much as dropping them: silence would hide that the machine is a
 * poor instrument today, which is the thing worth knowing before recording a
 * baseline on it.
 */
export const confirmed = (first, second) => {
	const again = new Set(
		second
			.filter((problem) => problem.tag === "perf-regressed")
			.map((problem) => problem.where),
	);

	return {
		kept: first.filter(
			(problem) => problem.tag !== "perf-regressed" || again.has(problem.where),
		),
		unconfirmed: first.filter(
			(problem) => problem.tag === "perf-regressed" && !again.has(problem.where),
		),
	};
};

// ── Running the benches ──────────────────────────────────────────────────────

/**
 * Packages with at least one bench file, by directory.
 *
 * Untracked files count, unlike every other gate here: a bench being written is
 * the one a person wants measured, and refusing until it is staged would teach
 * them to run the tool by hand instead.
 */
const packagesWithBenches = () => {
	const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
		encoding: "utf8",
	})
		.trim()
		.split("\n")
		.filter((path) => /\.bench\.tsx?$/.test(path) && existsSync(path));

	return [...new Set(files.map((path) => path.replace(/\/(src|_playground)\/.*$/, "")))].sort();
};

/** One package's benches, as vitest reports them. */
const runBenches = (pkg) => {
	const out = join(tmpdir(), `lanka-bench-${pkg.replace(/\//g, "-")}.json`);
	rmSync(out, { force: true });

	execFileSync("npx", ["vitest", "bench", "--run", `--outputJson=${out}`], {
		cwd: pkg,
		encoding: "utf8",
		stdio: "pipe",
		shell: process.platform === "win32",
	});

	const report = JSON.parse(readFileSync(out, "utf8"));
	rmSync(out, { force: true });

	return report;
};

const main = () => {
	const write = process.argv.includes("--write");
	const report = process.argv.includes("--report");
	const problems = [];
	/** Flagged once and not by the second measurement: the machine, not the code. */
	const notReproduced = [];
	mkdirSync("perf", { recursive: true });

	const packages = packagesWithBenches();
	let measured = 0;

	for (const pkg of packages) {
		const report = runBenches(pkg);

		for (const group of uncalibrated(report)) {
			problems.push({
				tag: "perf-uncalibrated",
				where: `${pkg} → ${group}`,
				detail:
					"a bench group with no yardstick. Call `lankaBenchCalibration()` first: " +
					"without it the numbers are this machine's, and nothing can be compared " +
					"to them tomorrow.",
			});
		}

		const rows = ratiosOf(report);
		measured += rows.length;
		const path = baselinePath(pkg);

		if (write) {
			writeFileSync(path, renderBaseline(pkg, rows), "utf8");
			continue;
		}

		if (!existsSync(path)) {
			problems.push({
				tag: "perf-report-stale",
				where: path,
				detail: "benches exist and no baseline does. Record one with `--write`.",
			});
			continue;
		}

		const baseline = readBaseline(readFileSync(path, "utf8"));
		const found = compare(baseline, rows);
		const regressed = found.filter((problem) => problem.tag === "perf-regressed");

		// The second measurement, and only when there is something to confirm: a
		// green package must not pay for a bench run nobody needed.
		const { kept, unconfirmed } = regressed.length
			? confirmed(found, compare(baseline, ratiosOf(runBenches(pkg))))
			: { kept: found, unconfirmed: [] };

		for (const problem of unconfirmed) notReproduced.push(`${pkg} → ${problem.where}`);
		for (const problem of kept) {
			problems.push({ ...problem, where: `${pkg} → ${problem.where}` });
		}
	}

	if (write) {
		console.log(`perf baselines written: ${String(packages.length)}`);
		return;
	}

	if (problems.length > 0) {
		const said =
			`PERFORMANCE DIVERGES FROM THE BASELINE (${String(problems.length)})\n\n` +
			problems
				.map((problem) => `[${problem.tag}] ${problem.where}\n    ${problem.detail}`)
				.join("\n\n") +
			"\n\nCanon: skills/performance/SKILL.md";

		// `--report` prints and does not judge: it exists for the machine that
		// cannot be an instrument. Reading it, not exiting on it, is the point —
		// twenty operations across eight packages is the machine, and one operation
		// at 4× is worth somebody's afternoon.
		if (report) {
			console.log(`${said}\n\nReported, not judged: --report was given.`);
			return;
		}

		console.error(said);
		process.exit(1);
	}

	console.log(
		`the hot paths hold their numbers: ${String(measured)} operations in ` +
			`${String(packages.length)} packages` +
			(notReproduced.length > 0
				? `\n  ${String(notReproduced.length)} flagged once and not by the second ` +
					`measurement — this machine is a poor instrument today, do not record here:` +
					`\n    ${notReproduced.join("\n    ")}`
				: ""),
	);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
