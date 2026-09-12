import { Type } from "@sinclair/typebox";

/**
 * The other direction: the payload this backend expects back.
 *
 * A mapping from the domain, not a serialiser — and its own file, because it
 * changes when the backend's WRITE contract changes, which is not the same day
 * as its read contract.
 */
export const playgroundToApiSchema = Type.Transform(
	Type.Object({
		email: Type.String(),
		age: Type.Number(),
		isActive: Type.Boolean(),
	}),
)
	.Decode((domain) => ({
		user_email: domain.email,
		user_age: domain.age,
		is_active: domain.isActive ? 1 : 0,
	}))
	.Encode((wire) => ({
		email: wire.user_email,
		age: wire.user_age,
		isActive: wire.is_active === 1,
	}));
