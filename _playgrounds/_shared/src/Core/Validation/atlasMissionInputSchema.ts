import { z } from "zod";

/**
 * What a person may type, read by three different readers.
 *
 * The form's resolver, the gateway's payload check, and — in the hosts that
 * render a form — the library that owns the inputs. One schema object, because
 * Standard Schema is what all three speak; declaring the rule twice is how a
 * client and a server come to disagree about what a valid mission is.
 */
export const atlasMissionInputSchema = z.object({
	title: z.string().trim().min(4, "a title is at least 4 characters"),
	priority: z
		.number()
		.int("a priority is a whole number")
		.min(1, "1 is the most urgent")
		.max(5, "5 is the least urgent"),
	crewId: z.string().nullable(),
});
