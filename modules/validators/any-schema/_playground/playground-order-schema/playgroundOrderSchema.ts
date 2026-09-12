import { z } from "zod";

/**
 * The application's OWN feature, written in the library it chose: zod.
 *
 * This is the schema that would be the only kind in a healthy application. The
 * five beside it are the ones that arrived from somewhere else.
 */
export const playgroundOrderSchema = z.object({
	id: z.string(),
	total: z.number().nonnegative(),
	lines: z.array(z.object({ sku: z.string(), qty: z.number().int().positive() })),
});
