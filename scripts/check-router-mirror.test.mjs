/**
 * Pins `check-router-mirror.mjs`: the mirror is the source, or it fails.
 *
 * The script is a comparison, so the test drives the comparison — and the one
 * thing worth pinning beyond that is that the mirror carries a header saying it
 * is generated. Without it the file reads as the one to edit, which is how the
 * two wordings started diverging in the first place.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HEADER, MIRROR, SOURCE, mirrorOf } from "./check-router-mirror.mjs";

const SCRIPT = resolve("scripts/check-router-mirror.mjs");

const run = () => {
	try {
		return { code: 0, output: execFileSync(process.execPath, [SCRIPT], { encoding: "utf8" }) };
	} catch (error) {
		return { code: error.status, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
	}
};

describe("the router mirror", () => {
	it("is the source plus a header that says so", () => {
		const source = readFileSync(SOURCE, "utf8");
		const built = mirrorOf(source);

		expect(built.startsWith(HEADER)).toBe(true);
		expect(built.slice(HEADER.length)).toBe(source);
		expect(HEADER).toContain("DO NOT EDIT");
	});

	it("holds for the file that is checked in", () => {
		expect(readFileSync(MIRROR, "utf8")).toBe(mirrorOf(readFileSync(SOURCE, "utf8")));
	});

	it("passes on the repository as it stands", () => {
		const result = run();

		expect(result.code).toBe(0);
		expect(result.output).toContain("one wording");
	});

	it("would report a mirror that said something else", () => {
		// The failure this gate exists for: a rule edited in the generated copy,
		// which then disagrees with the canon nobody re-read.
		const drifted = mirrorOf("# lanka\n\nSomething the source does not say.\n");

		expect(drifted).not.toBe(readFileSync(MIRROR, "utf8"));
	});
});
