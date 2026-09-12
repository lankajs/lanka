import { Schema } from "effect";

/**
 * The other direction: the payload this backend expects back.
 *
 * A mapping from the domain, not a serialiser — and its own file, because it
 * changes when the backend's WRITE contract changes, which is not the same day
 * as its read contract.
 */
export const playgroundToApiSchema = Schema.transform(
	Schema.Struct({
		email: Schema.String,
		age: Schema.Number,
		isActive: Schema.Boolean,
	}),
	Schema.Struct({
		user_email: Schema.String,
		user_age: Schema.Number,
		is_active: Schema.Literal(0, 1),
	}),
	{
		strict: true,
		decode: (domain) => ({
			user_email: domain.email,
			user_age: domain.age,
			is_active: domain.isActive ? (1 as const) : (0 as const),
		}),
		encode: (wire) => ({
			email: wire.user_email,
			age: wire.user_age,
			isActive: wire.is_active === 1,
		}),
	},
);
