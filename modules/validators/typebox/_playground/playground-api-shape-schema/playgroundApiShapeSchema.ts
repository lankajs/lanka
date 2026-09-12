import { Type } from "@sinclair/typebox";

/**
 * What one backend sends, mapped to what this application says.
 *
 * The mapping is a SCHEMA, not an adapter: `validate` returns what the schema
 * produced, so reading the wire and building a domain object is one call. In
 * TypeBox that is `Type.Transform(...).Decode(...)`, and the validator runs the
 * decode pass only because this schema has one — `HasTransform` is asked once per
 * schema and cached.
 *
 * Kept apart from the schema that CHECKS the domain, because the two change for
 * different reasons — this one when the backend does, the other when the
 * application does.
 */
export const playgroundApiShapeSchema = Type.Transform(
	Type.Object({
		user_email: Type.String(),
		user_age: Type.Number(),
		is_active: Type.Union([Type.Literal(0), Type.Literal(1)]),
	}),
)
	.Decode((wire) => ({
		email: wire.user_email,
		age: wire.user_age,
		isActive: wire.is_active === 1,
	}))
	.Encode((domain) => ({
		user_email: domain.email,
		user_age: domain.age,
		is_active: domain.isActive ? (1 as const) : (0 as const),
	}));
