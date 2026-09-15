import type { FieldPath, UseFormReturn } from "react-hook-form";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";
import type { TPlaygroundSubmitFailure } from "../_types/TPlaygroundSubmitOutcome";

/**
 * The whole React Hook Form half of the seam: addresses, spelled its way.
 *
 * Segments joined with dots, which is how this library names a nested input. An
 * EMPTY path is the value as a whole and goes to `root` — an input named `""`
 * is one nothing renders, so the message would vanish.
 */
export const applyPlaygroundHookFormErrors = (
	form: UseFormReturn<IPlaygroundOrderInput>,
	failure: TPlaygroundSubmitFailure,
): void => {
	for (const field of failure.fields) {
		const address =
			field.path.length === 0
				? "root"
				: (field.path.join(".") as FieldPath<IPlaygroundOrderInput>);
		form.setError(address, { message: field.message });
	}

	if (failure.message) form.setError("root", { message: failure.message });
};
