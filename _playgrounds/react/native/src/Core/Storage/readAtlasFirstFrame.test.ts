import { describe, expect, it } from "vitest";
import { createAtlasDeviceStorage } from "./createAtlasDeviceStorage";
import { createAtlasFakeEngines } from "../../_Testing/createAtlasFakeEngines";
import { readAtlasFirstFrame } from "./readAtlasFirstFrame";

const storage = () => createAtlasDeviceStorage(createAtlasFakeEngines());

describe("readAtlasFirstFrame", () => {
	it("sends a stranger to the sign-in screen", () => {
		expect(readAtlasFirstFrame(storage()).screen).toBe("sign-in");
	});

	it("sends somebody who was signed in straight to the board", () => {
		const store = storage();
		store.setLocalSync("atlas.operator", "Ada");

		expect(readAtlasFirstFrame(store).screen).toBe("board");
	});

	it("answers WITHOUT awaiting anything", () => {
		// The whole reason `@lankajs/mmkv` is in this application. Over an awaited
		// engine the same code renders the sign-in screen first and the board a
		// moment later, which a person reads as a flash rather than as a load.
		const store = storage();
		store.setLocalSync("atlas.operator", "Ada");

		const frame = readAtlasFirstFrame(store);

		expect(frame).not.toBeInstanceOf(Promise);
		expect(frame.screen).toBe("board");
	});

	it("carries what the person last sorted by, or nothing", () => {
		const store = storage();

		expect(readAtlasFirstFrame(store).sortField).toBeNull();

		store.setLocalSync("atlas.sortField", "priority");
		expect(readAtlasFirstFrame(store).sortField).toBe("priority");
	});
});
