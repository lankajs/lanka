import { lankaZodValidator } from "../../src/index";
import { playgroundSignUpSchema } from "../playground-sign-up-schema/playgroundSignUpSchema";
import type { IPlaygroundFormState } from "../_interfaces/IPlaygroundFormState";
import type { TPlaygroundSignUp } from "../playground-sign-up-schema/playgroundSignUpSchema";

/**
 * A form that never throws: a failed submit becomes messages beside inputs.
 *
 * Both paths the validator port offers are here, because choosing between them
 * is the decision a consumer actually makes: a user mistake is data, a shape the
 * server promised and did not send is a bug.
 */
export const createPlaygroundForm = () => {
	const state: IPlaygroundFormState = { value: null, fieldErrors: [] };

	return {
		get state(): IPlaygroundFormState {
			return state;
		},

		submit(input: unknown): boolean {
			const result = lankaZodValidator.validateSafe<TPlaygroundSignUp>(
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
			lankaZodValidator.validate<TPlaygroundSignUp>(
				playgroundSignUpSchema,
				input,
				"playground sign-up",
			),
	};
};
