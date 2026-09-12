import * as v from "valibot";

/**
 * The same mapping as `@lankajs/zod`'s playground, in valibot.
 *
 * The mapping is a SCHEMA, not an adapter: `validate` returns the transformed
 * value, so reading the wire and producing a domain object is one call. That the
 * two libraries express it differently and the framework sees no difference is
 * the whole promise of the port.
 */
export const playgroundApiShapeSchema = v.pipe(
	v.object({
		user_email: v.string(),
		user_age: v.number(),
		is_active: v.union([v.literal(0), v.literal(1)]),
	}),
	v.transform((api) => ({
		email: api.user_email,
		age: api.user_age,
		isActive: api.is_active === 1,
	})),
);
