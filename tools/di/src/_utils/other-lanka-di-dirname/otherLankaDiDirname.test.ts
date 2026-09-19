import { describe, expect, it } from "vitest";
import { lankaDiContract } from "../../lanka-di-contract/lankaDiContract";
import { otherLankaDiDirname } from "./otherLankaDiDirname";

describe("otherLankaDiDirname", () => {
	it.each(lankaDiContract.dirnames)("answers a legal name for %s", (dirname) => {
		expect(lankaDiContract.dirnames).toContain(otherLankaDiDirname(dirname));
	});

	it("never answers with the name it was given", () => {
		for (const dirname of lankaDiContract.dirnames) {
			expect(otherLankaDiDirname(dirname)).not.toBe(dirname);
		}
	});

	// Round-tripping is what both callers rely on: the message that sends a reader
	// to the other directory, and the shard resolver that looks for the rest of
	// the wiring there.
	it("round-trips", () => {
		for (const dirname of lankaDiContract.dirnames) {
			expect(otherLankaDiDirname(otherLankaDiDirname(dirname))).toBe(dirname);
		}
	});
});
