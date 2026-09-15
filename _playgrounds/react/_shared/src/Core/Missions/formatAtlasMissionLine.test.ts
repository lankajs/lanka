import { describe, expect, it } from "vitest";
import { formatAtlasMissionLine } from "./formatAtlasMissionLine";
import { atlasMission } from "../../_Testing/atlasMissionFixtures";

describe("formatAtlasMissionLine", () => {
	it("is ONE string, which is the whole reason it exists", () => {
		const line = formatAtlasMissionLine(
			atlasMission("m-1", { title: "Survey the north ridge" }),
		);

		// A test matching `AT-101 Survey the north ridge` passes here and fails
		// against `{code} {title}` in JSX, because that renders two text nodes with
		// no space between them in the accessibility tree. The rule is invisible on
		// screen, which is exactly why it is a function and not a convention.
		expect(line).toBe("AT-101 Survey the north ridge");
	});

	it("reads the mission and nothing around it", () => {
		expect(formatAtlasMissionLine(atlasMission("m-2", { status: "done", priority: 1 }))).toBe(
			"AT-102 Mission m-2",
		);
	});
});
