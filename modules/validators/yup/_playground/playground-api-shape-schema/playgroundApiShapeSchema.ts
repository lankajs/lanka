import * as yup from "yup";

/**
 * What one backend sends, mapped to what this application says.
 *
 * The mapping is a SCHEMA, not an adapter: one call reads the wire and produces
 * a domain object, so there is no adapter layer and no `adapt()` beside
 * `validate()`.
 *
 * ## Where yup differs from the rest of the family, and why the shape is this way
 *
 * zod, valibot and arktype transform AFTER validating, so their mapping schema
 * describes the wire and pipes it into the domain. yup's `transform` is part of
 * the CAST and runs BEFORE the checks. So the schema here describes the DOMAIN
 * and the transform produces it from the original value — the same two jobs in
 * the opposite order, which is a fact about yup rather than a difference in what
 * the package promises.
 *
 * Kept apart from the schema that CHECKS the domain, because the two change for
 * different reasons — this one when the backend does, the other when the
 * application does.
 */
export const playgroundApiShapeSchema = yup
	.object({
		email: yup.string().required(),
		age: yup.number().required(),
		isActive: yup.boolean().required(),
	})
	.transform((_cast: unknown, original: unknown) => {
		if (original === null || typeof original !== "object") return original;

		const wire = original as Record<string, unknown>;

		return { email: wire.user_email, age: wire.user_age, isActive: wire.is_active === 1 };
	});
