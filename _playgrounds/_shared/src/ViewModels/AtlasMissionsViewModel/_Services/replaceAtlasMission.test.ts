import { describe, expect, it } from "vitest";
import { replaceAtlasMission } from "./replaceAtlasMission";
import type { IAtlasMission } from "../../../Core/Interfaces/IAtlasMission";

const mission = (id: string, title = "Survey the ridge"): IAtlasMission => ({
	id,
	code: `AT-${id.replace(/\D/g, "")}`,
	title,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-13T00:00:00.000Z",
});

describe("replaceAtlasMission", () => {
	it("puts the changed mission where the old one stood", () => {
		const before = [mission("m-1"), mission("m-2"), mission("m-3")];

		const after = replaceAtlasMission(before, mission("m-2", "Restock the depot"));

		expect(after.map((one) => one.title)).toEqual([
			"Survey the ridge",
			"Restock the depot",
			"Survey the ridge",
		]);
	});

	it("answers the SAME array for a mission this screen does not hold", () => {
		// Identity, not equality. The list is a prop for every row below it, and a
		// new array for a change that touched nothing re-renders a screen that did
		// not move — which a scenario handler does constantly, because facts arrive
		// about rows this screen never loaded.
		const before = [mission("m-1")];

		expect(replaceAtlasMission(before, mission("m-99"))).toBe(before);
	});

	it("leaves the array it was given alone", () => {
		const before = [mission("m-1")];

		replaceAtlasMission(before, mission("m-1", "changed"));

		expect(before[0].title).toBe("Survey the ridge");
	});
});
