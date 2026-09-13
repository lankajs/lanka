import { describe, expect, it } from "vitest";
import * as atlas from "./index";

/**
 * What this package hands the four applications above it.
 *
 * A cross-cutting test: no single unit owns the barrel, and the barrel is what a
 * host actually imports. Four applications resolve these names, so a rename here
 * is a rename in four places — and until something reads the list, the barrel is
 * the one file in the package nothing executes.
 *
 * It asserts the SHAPE rather than the count. A count would fail on every
 * addition, which trains a reader to update the number without looking.
 */
describe("what Atlas publishes", () => {
	it("publishes one way to start, and the app it answers", () => {
		expect(typeof atlas.startAtlas).toBe("function");
	});

	it("publishes every gateway a host needs, in both writing styles", () => {
		expect(typeof atlas.AtlasMissionGateway).toBe("function");
		expect(typeof atlas.AtlasSessionGateway).toBe("function");
		expect(typeof atlas.AtlasBoardGateway).toBe("function");
		expect(typeof atlas.createAtlasCrewGateway).toBe("function");
		expect(typeof atlas.createAtlasTelemetryGateway).toBe("function");
	});

	it("publishes the four facts screens announce to each other", () => {
		for (const scenario of [
			atlas.atlasMissionCompleted,
			atlas.atlasMissionAssigned,
			atlas.atlasBoardMessagePosted,
			atlas.atlasSessionEnded,
		]) {
			expect(typeof scenario.eventType).toBe("string");
			expect(typeof scenario.trigger).toBe("function");
		}
	});

	it("gives every scenario its own event type, or one of them is silence", () => {
		// A duplicate would deliver both scenarios to both sets of handlers, which
		// is not an error anywhere — it is a screen reacting to something that did
		// not happen.
		const types = [
			atlas.atlasMissionCompleted.eventType,
			atlas.atlasMissionAssigned.eventType,
			atlas.atlasBoardMessagePosted.eventType,
			atlas.atlasSessionEnded.eventType,
		];

		expect(new Set(types).size).toBe(types.length);
	});

	it("publishes every ViewModel shape the framework has", () => {
		expect(typeof atlas.createAtlasMissionsVM).toBe("function"); // stateful, by calling
		expect(typeof atlas.AtlasBoardVM).toBe("function"); // stateful, as a class
		expect(typeof atlas.AtlasDispatchStepVM).toBe("function"); // shared store, as a class
		expect(typeof atlas.createAtlasCrewStepVM).toBe("function"); // shared store, by calling
		expect(typeof atlas.createAtlasStatsVM).toBe("function"); // stateless
		expect(typeof atlas.createAtlasTelemetryVM).toBe("function"); // lazy
		expect(typeof atlas.createAtlasMissionEditVM).toBe("function"); // a form's other half
	});

	it("publishes the store two dispatch steps share, and the singletons", () => {
		expect(typeof atlas.AtlasDispatchDraftStore).toBe("function");
		expect(typeof atlas.AtlasSession).toBe("function");
		expect(typeof atlas.AtlasClock).toBe("function");
	});

	it("publishes a schema from every library this application mixes", () => {
		for (const schema of [
			atlas.atlasMissionSchema,
			atlas.atlasMissionInputSchema,
			atlas.atlasMissionWireSchema,
			atlas.atlasCrewSchema,
			atlas.atlasSessionSchema,
			atlas.atlasBoardSchema,
			atlas.atlasTelemetrySchema,
		]) {
			expect(schema).toBeDefined();
		}
	});

	it("publishes the two readings a host does on a failure", () => {
		expect(typeof atlas.readAtlasFailure).toBe("function");
		expect(typeof atlas.sortAtlasSubmitFailure).toBe("function");
	});
});
