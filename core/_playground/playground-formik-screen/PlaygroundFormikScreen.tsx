import { getIn, setIn, useFormik } from "formik";
import { lankaStandardValidator } from "../../src/validation/index";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import type { FormikErrors } from "formik";
import type { IPlaygroundFormScreenProps } from "../_interfaces/IPlaygroundFormScreenProps";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/**
 * The edit form on Formik — a library that does not read Standard Schema.
 *
 * It does not need to: the validation port reads the schema and answers
 * `fields`, and Formik's nested error object is folded from those with its own
 * `setIn`. Server failures take the same road through `setFieldError`. So the
 * bridge to a library without Standard Schema is the same three lines, plus one
 * `validate` — and the ViewModel, the gateway and the schema are untouched.
 */
export const PlaygroundFormikScreen = ({ initial, submit }: IPlaygroundFormScreenProps) => {
	const formik = useFormik<IPlaygroundOrderInput>({
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
				helpers.setStatus({ savedVersion: outcome.data.updatedAt });
				return;
			}

			// Segments → this library's spelling; an empty path is the form's root.
			const root = outcome.fields.find((field) => field.path.length === 0);
			for (const field of outcome.fields) {
				if (field.path.length > 0)
					helpers.setFieldError(field.path.join("."), field.message);
			}
			const rootMessage = outcome.message ?? root?.message;
			if (rootMessage) helpers.setStatus({ root: rootMessage });
		},
	});

	const status = (formik.status ?? {}) as { savedVersion?: number; root?: string };
	const messageAt = (address: string): string | undefined =>
		getIn(formik.errors, address) as string | undefined;

	return (
		<form onSubmit={formik.handleSubmit}>
			<input
				aria-label="customer"
				name="customer"
				value={formik.values.customer}
				onChange={formik.handleChange}
			/>
			{messageAt("customer") ? <span role="alert">{messageAt("customer")}</span> : null}
			{formik.values.items.map((item, index) => (
				<div key={item.sku}>
					<input
						aria-label={`qty ${String(index)}`}
						type="number"
						name={`items.${String(index)}.qty`}
						value={item.qty}
						onChange={(event) => {
							void formik.setFieldValue(
								`items.${String(index)}.qty`,
								Number(event.target.value),
							);
						}}
					/>
					{messageAt(`items.${String(index)}.qty`) ? (
						<span role="alert">{messageAt(`items.${String(index)}.qty`)}</span>
					) : null}
				</div>
			))}
			{status.root ? <p role="alert">{status.root}</p> : null}
			<button type="submit">save</button>
			{status.savedVersion !== undefined ? <p>saved v{status.savedVersion}</p> : null}
		</form>
	);
};
