import { z } from "zod";

/**
 * What the application requires a mission to be — written in zod.
 *
 * This is the schema that changes when the APPLICATION does. The one beside it
 * (`atlasMissionWireSchema`) changes when the SERVER does, and keeping them
 * apart is the whole reason there is no adapter layer here: Standard Schema's
 * validate answers the transformed value, so a mapping is a schema like any
 * other and two jobs stay two files.
 */
export const atlasMissionSchema = z.object({
	id: z.string().min(1),
	code: z.string().regex(/^AT-\d+$/),
	title: z.string().min(1),
	status: z.union([z.literal("queued"), z.literal("active"), z.literal("done")]),
	priority: z.number().int().min(1).max(5),
	crewId: z.string().nullable(),
	updatedAt: z.string(),
});
