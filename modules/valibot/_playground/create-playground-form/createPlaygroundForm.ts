import { lankaValibotValidator } from "../../src/index";
import { playgroundSignUpSchema } from "../playground-sign-up-schema/playgroundSignUpSchema";
import type { IPlaygroundFormState } from "../_interfaces/IPlaygroundFormState";
import type { TPlaygroundSignUp } from "../playground-sign-up-schema/playgroundSignUpSchema";

/**
 * The same form as `@lankajs/zod`'s, against the same port.
 *
 * A validator is swapped by changing which of these two packages is installed,
 * and that claim only holds while both playgrounds ask the same questions of
 * the same shape.
 */
export const createPlaygroundForm = () => {
	const state: IPlaygroundFormState = { value: null, fieldErrors: [] };

	return {
		get state(): IPlaygroundFormState {
			return state;
		},

		submit(input: unknown): boolean {
			const result = lankaValibotValidator.validateSafe<TPlaygroundSignUp>(
				playgroundSignUpSchema,
				input,
			);

			if (!result.success) {
				state.fieldErrors = result.errors;
				state.value = null;
				return false;
			}

			state.fieldErrors = [];
			state.value = result.data;
			return true;
		},

		/** The strict path: used where a failure is a bug, not a user mistake. */
		parseOrThrow: (input: unknown): TPlaygroundSignUp =>
			lankaValibotValidator.validate<TPlaygroundSignUp>(
				playgroundSignUpSchema,
				input,
				"playground sign-up",
			),
	};
};
