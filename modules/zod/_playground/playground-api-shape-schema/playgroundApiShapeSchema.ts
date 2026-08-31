import { z } from "zod";

/**
 * What one backend sends, mapped to what this application says.
 *
 * The mapping is a SCHEMA, not an adapter: `validate` returns the transformed
 * value, so reading the wire and producing a domain object is one call. A
 * per-library adapter class would be a second name for it.
 *
 * Kept apart from the schema that CHECKS the domain, because the two change for
 * different reasons — this one when the backend does, the other when the
 * application does.
 */
export const playgroundApiShapeSchema = z
	.object({
		user_email: z.string(),
		user_age: z.number(),
		is_active: z.union([z.literal(0), z.literal(1)]),
	})
	.transform((api) => ({
		email: api.user_email,
		age: api.user_age,
		isActive: api.is_active === 1,
	}));
