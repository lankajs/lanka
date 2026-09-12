import type { TPlaygroundSubmitFailure } from "../_types/TPlaygroundSubmitOutcome";

/** TanStack Form spells a list address with brackets: `items[1].qty`. */
const toBracketAddress = (path: readonly (string | number)[]): string =>
	path.reduce<string>((address, segment) => {
		if (typeof segment === "number") return `${address}[${String(segment)}]`;
		return address ? `${address}.${segment}` : segment;
	}, "");

/**
 * The whole TanStack Form half of the seam.
 *
 * This library takes the server's answer as the RETURN of an async submit
 * validator — `{ form, fields }` — rather than through an imperative call, which
 * is the one place its shape differs from React Hook Form's. The addresses are
 * the same segments, spelled its way; an EMPTY path is the value as a whole and
 * becomes the form-wide message.
 */
export const toPlaygroundTanstackErrors = (
	failure: TPlaygroundSubmitFailure,
): { form: string | undefined; fields: Record<string, string> } => {
	const root = failure.fields.find((field) => field.path.length === 0);

	return {
		form: failure.message ?? root?.message,
		fields: Object.fromEntries(
			failure.fields
				.filter((field) => field.path.length > 0)
				.map((field) => [toBracketAddress(field.path), field.message]),
		),
	};
};
