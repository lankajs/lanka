import { describe, expect, it } from "vitest";
import { AtlasChanges } from "./AtlasChanges";

describe("AtlasChanges", () => {
	it("carries a change to everyone listening", () => {
		const changes = new AtlasChanges();
		const seen: string[] = [];
		changes.listen((change) => seen.push(`a:${change.type}`));
		changes.listen((change) => seen.push(`b:${change.type}`));

		changes.announce("mission.completed", { id: "1" });

		expect(seen).toEqual(["a:mission.completed", "b:mission.completed"]);
	});

	it("stops carrying to a listener that unsubscribed", () => {
		const changes = new AtlasChanges();
		const seen: string[] = [];
		const stop = changes.listen((change) => seen.push(change.type));

		stop();
		changes.announce("mission.completed", {});

		expect(seen).toEqual([]);
		expect(changes.listenerCount()).toBe(0);
	});

	it("still reaches the second listener when the first unsubscribes mid-delivery", () => {
		// A socket that closes on the frame it just received does exactly this.
		// Iterating the live set would skip whoever stood after it.
		const changes = new AtlasChanges();
		const seen: string[] = [];

		const stop = changes.listen(() => {
			stop();
			seen.push("first");
		});
		changes.listen(() => seen.push("second"));

		changes.announce("mission.assigned", {});

		expect(seen).toEqual(["first", "second"]);
	});
});
