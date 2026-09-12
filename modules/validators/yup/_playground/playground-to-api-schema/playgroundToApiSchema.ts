import * as yup from "yup";

/**
 * The other direction: the payload this backend expects back.
 *
 * A mapping from the domain, not a serialiser — and its own file, because it
 * changes when the backend's WRITE contract changes, which is not the same day
 * as its read contract.
 */
export const playgroundToApiSchema = yup
	.object({
		user_email: yup.string().required(),
		user_age: yup.number().required(),
		is_active: yup.number().oneOf([0, 1]).required(),
	})
	.transform((_cast: unknown, original: unknown) => {
		if (original === null || typeof original !== "object") return original;

		const domain = original as Record<string, unknown>;

		return {
			user_email: domain.email,
			user_age: domain.age,
			is_active: domain.isActive === true ? 1 : 0,
		};
	});
