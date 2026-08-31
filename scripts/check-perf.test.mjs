/**
 * Pins `check-perf.mjs`: what it reads out of a bench run, and what it refuses.
 *
 * The run itself is not driven here — a test that spends a minute measuring
 * would be a benchmark of the benchmarks. What is pinned is every decision the
 * script makes about the numbers once it has them, plus the one string it has to
 * repeat because a `.mjs` gate cannot import TypeScript.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	CALIBRATION_NAME,
	TOLERANCE,
	compare,
	confirmed,
	ratiosOf,
	readBaseline,
	renderBaseline,
	uncalibrated,
} from "./check-perf.mjs";

/** A vitest bench report, in the shape the script actually receives. */
const report = (benchmarks, fullName = "src/x/x.bench.ts > x") => ({
	files: [{ filepath: "/repo/src/x/x.bench.ts", groups: [{ fullName, benchmarks }] }],
});

const yardstick = { name: CALIBRATION_NAME, hz: 20_000_000, rme: 0.5 };

describe("the yardstick", () => {
	it("is the same string the test kit registers", () => {
		// Two copies by necessity: the kit is TypeScript and this gate is a plain
		// script node runs directly. A drift between them would make every bench
		// file look uncalibrated, so the copies are pinned to each other.
		const kit = readFileSync("tools/testing/src/lankaBenchCalibration.ts", "utf8");

		expect(kit).toContain(`"${CALIBRATION_NAME}"`);
	});

	it("is required of every group", () => {
		expect(uncalibrated(report([{ name: "a call", hz: 1, rme: 1 }]))).toEqual([
			"src/x/x.bench.ts > x",
		]);
		expect(uncalibrated(report([yardstick]))).toEqual([]);
	});
});

describe("what a run is reduced to", () => {
	it("measures a call in yardsticks, not in hertz", () => {
		const rows = ratiosOf(report([yardstick, { name: "a call", hz: 10_000_000, rme: 1 }]));

		// Half the throughput of a plain property read is two reads per call — the
		// number that survives a different machine, a warm cache and a busy CPU.
		expect(rows).toHaveLength(1);
		expect(rows[0].ratio).toBe(2);
	});

	it("drops the yardstick itself from the report", () => {
		expect(ratiosOf(report([yardstick])).map((row) => row.name)).toEqual([]);
	});

	it("says nothing about a group that never registered one", () => {
		expect(ratiosOf(report([{ name: "a call", hz: 1, rme: 1 }]))).toEqual([]);
	});
});

describe("the baseline on disk", () => {
	const rows = [
		{ group: "a.bench.ts > a", name: "one call", ratio: 1.28, hz: 19_900_870, rme: 0.99 },
	];

	it("round-trips through the file it writes", () => {
		expect(readBaseline(renderBaseline("core", rows))).toEqual(
			new Map([["a.bench.ts > a :: one call", 1.28]]),
		);
	});

	it("keeps the hertz for scale and compares nothing by it", () => {
		const written = renderBaseline("core", rows);

		expect(written).toContain("19,900,870");
		expect([...readBaseline(written).values()]).toEqual([1.28]);
	});
});

describe("comparing a run to the baseline", () => {
	const recorded = new Map([["a.bench.ts > a :: one call", 1.0]]);
	const row = (ratio) => [{ group: "a.bench.ts > a", name: "one call", ratio, hz: 1, rme: 1 }];

	it("passes noise", () => {
		expect(compare(recorded, row(1.15))).toEqual([]);
	});

	it("passes an improvement without asking anything", () => {
		// Getting faster is never a failure; recording it is the author's move, and
		// the diff of the baseline is where it gets read.
		expect(compare(recorded, row(0.4))).toEqual([]);
	});

	it("reports a call that became three times dearer", () => {
		const [problem] = compare(recorded, row(3));

		expect(problem.tag).toBe("perf-regressed");
		expect(problem.detail).toContain("1.00 → 3.00");
	});

	it("holds the tolerance where the canon says", () => {
		expect(TOLERANCE).toBe(1.6);
		expect(compare(recorded, row(1.59))).toEqual([]);
		expect(compare(recorded, row(1.61))[0].tag).toBe("perf-regressed");
	});

	it("reports a bench nobody recorded, and a record nothing measures", () => {
		expect(compare(new Map(), row(1))[0].tag).toBe("perf-report-stale");
		expect(compare(recorded, [])[0].tag).toBe("perf-report-stale");
	});
});

describe("a baseline somebody ran the formatter over", () => {
	it("still compares, padding and all", () => {
		const formatted = [
			"## a.bench.ts > a",
			"",
			"| Operation | × yardstick | hz         | ±rme  |",
			"| --------- | ----------- | ---------- | ----- |",
			"| one call  | 1.28        | 19,900,870 | 0.99% |",
		].join("\n");

		expect(readBaseline(formatted)).toEqual(new Map([["a.bench.ts > a :: one call", 1.28]]));
	});

	it("reads no number out of the separator row", () => {
		expect(readBaseline("## a\n\n| --- | --- |")).toEqual(new Map());
	});
});

describe("measuring a flagged regression a second time", () => {
	const regressed = (where) => ({ tag: "perf-regressed", where, detail: "…" });
	const stale = (where) => ({ tag: "perf-report-stale", where, detail: "…" });

	it("keeps what the second measurement agrees with", () => {
		// A regression worth 1.6× reproduces. That is the whole reason the second
		// run is allowed to have a vote.
		const { kept, unconfirmed } = confirmed([regressed("a :: one")], [regressed("a :: one")]);

		expect(kept).toHaveLength(1);
		expect(unconfirmed).toEqual([]);
	});

	it("drops what it does not, and says so", () => {
		// The CI run that produced this reader: three unrelated operations at ~2×
		// on a two-core shared runner, none of them touched by the commit.
		const { kept, unconfirmed } = confirmed([regressed("a :: one")], []);

		expect(kept).toEqual([]);
		expect(unconfirmed).toHaveLength(1);
	});

	it("never re-reads a stale row, which a second run cannot change its mind about", () => {
		// A baseline row nothing measures is a fact about the files. Putting it to a
		// vote would make the gate forget a bench that stopped running.
		const { kept, unconfirmed } = confirmed([stale("a :: gone")], []);

		expect(kept).toHaveLength(1);
		expect(unconfirmed).toEqual([]);
	});

	it("judges each operation on its own", () => {
		const { kept, unconfirmed } = confirmed(
			[regressed("a :: one"), regressed("a :: two")],
			[regressed("a :: two")],
		);

		expect(kept.map((problem) => problem.where)).toEqual(["a :: two"]);
		expect(unconfirmed.map((problem) => problem.where)).toEqual(["a :: one"]);
	});
});
