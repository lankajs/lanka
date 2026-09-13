import { LankaValidationError } from "lanka/validation";
import { describe, expect, it } from "vitest";
import { atlasValidator } from "./atlasValidator";
import { atlasBoardSchema } from "./atlasBoardSchema";
import { atlasCrewSchema } from "./atlasCrewSchema";
import { atlasMissionSchema } from "./atlasMissionSchema";
import { atlasMissionWireSchema } from "./atlasMissionWireSchema";
import { atlasSessionSchema } from "./atlasSessionSchema";
import { atlasTelemetrySchema } from "./atlasTelemetrySchema";
import type { IAtlasCrewMember } from "../Interfaces/IAtlasCrewMember";
import type { IAtlasMission } from "../Interfaces/IAtlasMission";
import type { IAtlasCredentials } from "../Interfaces/IAtlasCredentials";

const mission = {
	id: "m-1",
	code: "AT-101",
	title: "Survey the north ridge",
	status: "active",
	priority: 1,
	crewId: "c-1",
	updatedAt: "2026-09-13T00:00:00.000Z",
};

describe("atlasValidator — one hub, four dialects", () => {
	it("reads a zod schema", () => {
		expect(atlasValidator.validate<IAtlasMission>(atlasMissionSchema, mission, "t").id).toBe(
			"m-1",
		);
	});

	it("reads a valibot schema, which is the SAME dialect as zod", () => {
		// The claim this file exists to keep honest: zod, valibot and arktype are
		// one dialect, so an application mixing only those three needs no hub at
		// all. Registering three entries for them would suggest they are three.
		const mapped = atlasValidator.validate<IAtlasMission>(
			atlasMissionWireSchema,
			{
				mission_id: "m-7",
				mission_title: "Raise the mast",
				mission_state: "ACTIVE",
				assigned_to: null,
				changed_at: 1_700_000_000,
			},
			"t",
		);

		expect(mapped.id).toBe("m-7");
		expect(mapped.status).toBe("active");
	});

	it("reads an arktype schema, the third of that one dialect", () => {
		const crew: IAtlasCrewMember = {
			id: "c-1",
			name: "Ada Lovelace",
			avatarUrl: "/api/crew/c-1/avatar.png",
		};

		expect(atlasValidator.validate<IAtlasCrewMember>(atlasCrewSchema, crew, "t").name).toBe(
			"Ada Lovelace",
		);
	});

	it("reads a yup schema, whose Standard Schema is async and cannot go through the port", () => {
		const session: IAtlasCredentials = {
			token: "t",
			refreshToken: "r",
			csrf: "c",
			name: "Ada",
		};

		expect(
			atlasValidator.validate<IAtlasCredentials>(atlasSessionSchema, session, "t").name,
		).toBe("Ada");
	});

	it("reads a TypeBox schema, which publishes no Standard Schema at all", () => {
		const board = { queued: 3, active: 1, forecast: null };

		expect(atlasValidator.validate<typeof board>(atlasBoardSchema, board, "t").queued).toBe(3);
	});

	it("reads an Effect schema, whose Standard Schema is behind a function", () => {
		const telemetry = { kind: "opened", queued: 3, active: 1, done: 1 };

		expect(
			atlasValidator.validate<typeof telemetry>(atlasTelemetrySchema, telemetry, "t").done,
		).toBe(1);
	});

	it("transforms as it validates, which is why there is no adapter layer", () => {
		// Standard Schema's validate answers the TRANSFORMED value, so mapping a
		// wire format is a schema like any other. An adapter here would have
		// nothing to do.
		const mapped = atlasValidator.validate<IAtlasMission>(
			atlasMissionWireSchema,
			{
				mission_id: "m-9",
				mission_title: "Walk the perimeter",
				mission_state: "DONE",
				assigned_to: "c-2",
				changed_at: 1_700_000_000,
			},
			"t",
		);

		expect(mapped.code).toBe("AT-9");
		expect(mapped.updatedAt).toMatch(/^\d{4}-/);
	});

	it("refuses a body that is the wrong shape, naming the call", () => {
		// The label is what turns "invalid response" into "which request".
		expect(() =>
			atlasValidator.validate(
				atlasMissionSchema,
				{ ...mission, priority: 99 },
				"missions.list",
			),
		).toThrow(LankaValidationError);
	});

	it("refuses a value that is no schema of any dialect, and says so", () => {
		// Two failures that look alike and are not: this one is a bug in the
		// calling code, and the other is an install. One message would send half
		// the readers the wrong way.
		expect(() => atlasValidator.validate({ nope: true }, {}, "t")).toThrow(/not a schema/i);
	});

	it("throws from validateSafe too, when the SCHEMA is the problem", () => {
		// A refused value is an outcome a form renders; a schema nothing was
		// registered for is a wiring mistake, and returning it in `errors` would
		// put a programmer's error beside somebody's typing.
		expect(() => atlasValidator.validateSafe({ nope: true }, {})).toThrow();
	});

	it("answers rather than throws for a refused VALUE", () => {
		const outcome = atlasValidator.validateSafe(atlasMissionSchema, { id: 1 });

		expect(outcome.success).toBe(false);
	});
});
