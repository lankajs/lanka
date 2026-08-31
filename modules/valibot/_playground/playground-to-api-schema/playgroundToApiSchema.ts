import * as v from "valibot";

/**
 * The other direction: the payload this backend expects back.
 *
 * A mapping from the domain, not a serialiser — and its own file, because it
 * changes when the backend's WRITE contract changes, which is not the same day
 * as its read contract.
 */
export const playgroundToApiSchema = v.pipe(
	v.object({ email: v.string(), age: v.number(), isActive: v.boolean() }),
	v.transform((domain) => ({
		user_email: domain.email,
		user_age: domain.age,
		is_active: domain.isActive ? 1 : 0,
	})),
);
