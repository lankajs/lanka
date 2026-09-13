import * as v from "valibot";

/** The status names the older endpoint uses, and what each one means here. */
const STATES: Record<string, "queued" | "active" | "done"> = {
	QUEUED: "queued",
	ACTIVE: "active",
	DONE: "done",
};

/**
 * The shape an older endpoint still speaks, mapped into this application's.
 *
 * Written in **valibot** while the domain schema beside it is zod, and that is
 * not decoration: the two are one DIALECT — zod 4, valibot and arktype all
 * publish a synchronous Standard Schema — so any validator in the family reads
 * both, and an application mixing only these three needs no routing hub at all.
 * The hub exists for the dialects that are genuinely different, which is a
 * distinction this file is here to keep honest.
 *
 * The transform is the mapping. There is no adapter layer because there is
 * nothing for one to do.
 */
export const atlasMissionWireSchema = v.pipe(
	v.object({
		mission_id: v.string(),
		mission_title: v.string(),
		mission_state: v.string(),
		assigned_to: v.nullable(v.string()),
		changed_at: v.number(),
	}),
	v.transform((row) => ({
		id: row.mission_id,
		// The older endpoint carries no code, and inventing one from the id would
		// put a value on screen that no radio call will ever match. It is derived
		// visibly instead, so a reader can see where it came from.
		code: `AT-${row.mission_id.replace(/\D/g, "")}`,
		title: row.mission_title,
		status: STATES[row.mission_state] ?? "queued",
		priority: 3,
		crewId: row.assigned_to,
		updatedAt: new Date(row.changed_at * 1000).toISOString(),
	})),
);
