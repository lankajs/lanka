import { type } from "arktype";

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
export const playgroundApiShapeSchema = type({
	user_email: "string",
	user_age: "number",
	is_active: "0 | 1",
}).pipe((api) => ({
	email: api.user_email,
	age: api.user_age,
	isActive: api.is_active === 1,
}));
