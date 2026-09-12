import { lankaStandardValidator } from "../../../src/validation/index";
import type { TLankaSchema } from "../../../src/validation/index";
import type { IPlaygroundForm } from "../../_interfaces/IPlaygroundForm";

/**
 * A form library, reduced to what the seam needs.
 *
 * Under `_testing/` because it stands in for the outside world — React Hook Form
 * or TanStack Form — and a scene that pulled either in would be a scene about
 * that library. What it keeps of them is exact: it owns the values, it owns the
 * per-input errors, its resolver is a Standard Schema, and on submit it hands
 * validated values on and nothing else. It cannot reach a gateway, a scenario or
 * a cache because it is given none.
 */
export const createPlaygroundForm = <TValues extends object>(
	schema: TLankaSchema<TValues>,
	defaults: TValues,
): IPlaygroundForm<TValues> => {
	let initial = defaults;
	let values = { ...defaults };
	const errors = new Map<string, string>();

	return {
		get values() {
			return values;
		},
		get errors() {
			return errors;
		},
		get isDirty() {
			return JSON.stringify(values) !== JSON.stringify(initial);
		},
		setValues: (partial) => {
			values = { ...values, ...partial };
		},
		setError: (address, message) => {
			errors.set(address, message);
		},
		clearErrors: () => {
			errors.clear();
		},
		reset: (next = initial) => {
			initial = next;
			values = { ...next };
			errors.clear();
		},
		handleSubmit: async (onValid) => {
			errors.clear();
			// The resolver is the same schema the gateway checks the payload with.
			const checked = lankaStandardValidator.validateSafe(schema, values);
			if (!checked.success) {
				for (const field of checked.fields ?? []) {
					errors.set(field.path.join("."), field.message);
				}
				return;
			}
			await onValid(checked.data);
		},
		validateField: async (address, check) => {
			const message = await check(values);
			if (message === null) errors.delete(address);
			else errors.set(address, message);
		},
	};
};
