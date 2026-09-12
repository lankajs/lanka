import { getIn, setIn } from "formik";
import { lankaStandardValidator } from "../../src/validation/index";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import type { FormikConfig, FormikErrors } from "formik";
import type { IPlaygroundFormScreenProps } from "../_interfaces/IPlaygroundFormScreenProps";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/** What this screen keeps in Formik's free-form `status`. */
export interface IPlaygroundFormikStatus {
	savedVersion?: number;
	root?: string;
}

/** One message, wherever Formik put it in its nested error object. */
export const playgroundFormikMessageAt = (
	errors: FormikErrors<IPlaygroundOrderInput>,
	address: string,
): string | undefined => getIn(errors, address) as string | undefined;

/**
 * The whole Formik half of the seam.
 *
 * Formik reads no Standard Schema, and does not need to: the validation port
 * reads it and answers `fields`, and Formik's nested error object folds from
 * those with its own `setIn`. The server's failures take the same road through
 * `setFieldError`, with an EMPTY path going to `status` — Formik has no field
 * named `""` to hold it.
 *
 * So the bridge to a library WITHOUT Standard Schema is the same size as to one
 * with it, and the ViewModel, the gateway and the schema are untouched.
 */
export const createPlaygroundFormikOptions = ({
	initial,
	submit,
}: IPlaygroundFormScreenProps): FormikConfig<IPlaygroundOrderInput> => ({
	initialValues: initial,

	validate: (values) => {
		const checked = lankaStandardValidator.validateSafe(playgroundOrderInputSchema, values);
		if (checked.success) return {};

		return (checked.fields ?? []).reduce<FormikErrors<IPlaygroundOrderInput>>(
			(errors, field) =>
				setIn(
					errors,
					field.path.join("."),
					field.message,
				) as FormikErrors<IPlaygroundOrderInput>,
			{},
		);
	},

	onSubmit: async (values, helpers) => {
		const outcome = await submit(values);
		if (outcome.ok) {
			helpers.resetForm({ values });
			helpers.setStatus({
				savedVersion: outcome.data.updatedAt,
			} satisfies IPlaygroundFormikStatus);
			return;
		}

		const root = outcome.fields.find((field) => field.path.length === 0);
		for (const field of outcome.fields) {
			if (field.path.length > 0) helpers.setFieldError(field.path.join("."), field.message);
		}

		const message = outcome.message ?? root?.message;
		if (message) helpers.setStatus({ root: message } satisfies IPlaygroundFormikStatus);
	},
});
