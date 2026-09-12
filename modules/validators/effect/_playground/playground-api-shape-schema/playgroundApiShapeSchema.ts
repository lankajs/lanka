import { Schema } from "effect";

/**
 * What one backend sends, mapped to what this application says.
 *
 * The mapping is a SCHEMA, not an adapter: `validate` returns what the schema
 * produced, so reading the wire and building a domain object is one call. In
 * Effect that is `Schema.transform`, and the decoded side is the domain.
 *
 * Kept apart from the schema that CHECKS the domain, because the two change for
 * different reasons — this one when the backend does, the other when the
 * application does.
 */
export const playgroundApiShapeSchema = Schema.transform(
	Schema.Struct({
		user_email: Schema.String,
		user_age: Schema.Number,
		is_active: Schema.Literal(0, 1),
	}),
	Schema.Struct({
		email: Schema.String,
		age: Schema.Number,
		isActive: Schema.Boolean,
	}),
	{
		strict: true,
		decode: (wire) => ({
			email: wire.user_email,
			age: wire.user_age,
			isActive: wire.is_active === 1,
		}),
		encode: (domain) => ({
			user_email: domain.email,
			user_age: domain.age,
			is_active: domain.isActive ? (1 as const) : (0 as const),
		}),
	},
);
