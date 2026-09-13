import { beforeEach, describe, expect, it } from "vitest";
import { AtlasWorld } from "./AtlasWorld";
import type { IAtlasChange } from "../atlas-changes/AtlasChanges";

describe("AtlasWorld", () => {
	let world: AtlasWorld;
	let heard: IAtlasChange[];

	beforeEach(() => {
		world = new AtlasWorld({ now: () => 1_700_000_000_000 });
		heard = [];
		world.changes.listen((change) => heard.push(change));
	});

	it("starts from the same world every time, so a run cannot inherit the last one", () => {
		world.drop("m-1");
		world.reset();

		expect(world.mission("m-1")).toBeDefined();
		expect(world.missions()).toHaveLength(5);
	});

	it("mints the identity rather than taking one from the client", () => {
		const added = world.add({ title: "Clear the landing strip" });

		expect(added.id).not.toBe("");
		expect(added.code).toMatch(/^AT-\d+$/);
		expect(world.mission(added.id)?.title).toBe("Clear the landing strip");
	});

	it("trims a title, because a trailing space is not part of a name", () => {
		expect(world.add({ title: "  Clear the strip  " }).title).toBe("Clear the strip");
	});

	it("answers undefined for a mission that is not there", () => {
		// The route turns this into a 404. A throw would make the ordinary case
		// travel as a failure.
		expect(world.change("m-999", { title: "Nothing" })).toBeUndefined();
		expect(world.drop("m-999")).toBe(false);
	});

	it("moves the version on every write", () => {
		const before = world.mission("m-2")?.updatedAt;

		const after = world.change("m-2", { title: "Restock the depot twice" });

		expect(after?.updatedAt).not.toBe(before);
	});

	it("names what happened rather than announcing that something did", () => {
		// A screen reacts differently to a completion and to an assignment. One
		// generic `mission.changed` would make every subscriber re-derive it.
		world.change("m-2", { status: "done" });
		world.change("m-2", { crewId: "c-3" });
		world.change("m-2", { title: "Restock the forward depot" });

		expect(heard.map((change) => change.type)).toEqual([
			"mission.completed",
			"mission.assigned",
			"mission.edited",
		]);
	});

	it("announces an addition and a removal by their own names", () => {
		const added = world.add({ title: "Clear the landing strip" });
		world.drop(added.id);

		expect(heard.map((change) => change.type)).toEqual(["mission.added", "mission.dropped"]);
	});

	it("hands out copies, so a listener cannot edit the row it was told about", () => {
		world.change("m-2", { title: "Restock the forward depot" });
		const carried = heard[0].payload.mission as { title: string };

		carried.title = "tampered";

		expect(world.mission("m-2")?.title).toBe("Restock the forward depot");
	});

	it("keeps a partial change partial", () => {
		const before = world.mission("m-3");

		const after = world.change("m-3", { priority: 1 });

		expect(after?.title).toBe(before?.title);
		expect(after?.crewId).toBe(before?.crewId);
		expect(after?.priority).toBe(1);
	});

	it("can unassign a mission, which is a crewId of null and not an absent one", () => {
		const after = world.change("m-1", { crewId: null });

		expect(after?.crewId).toBeNull();
	});
});
