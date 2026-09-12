import { lankaYupValidator } from "../../src/index";
import { playgroundSignUpSchema } from "../playground-sign-up-schema/playgroundSignUpSchema";
import type { IPlaygroundScreenState } from "../_interfaces/IPlaygroundScreenState";
import type { TPlaygroundSignUp } from "../playground-sign-up-schema/playgroundSignUpSchema";

/**
 * A screen that puts a message beside the input it belongs to.
 *
 * The shape this package is shown in, and it is chosen for what only yup makes
 * interesting: yup addresses a field as `tags[0].id`, and the bridge hands back
 * SEGMENTS — `["tags", 0, "id"]`. This file is what those segments are for.
 *
 * It reads `fields`, never `errors`. The two carry the same issues, and the
 * difference is what they are for: `errors` is a banner's list, already joined;
 * `fields` keeps the address apart from the text, which is the only form an
 * input can be found by. Parsing an address back out of a joined string is not
 * safe — a message may contain a colon, a key may contain a dot — and that is
 * precisely why the port answers twice.
 */
export const createPlaygroundProfileScreen = () => {
	const state: IPlaygroundScreenState = { value: null, messages: {} };

	return {
		get state(): IPlaygroundScreenState {
			return state;
		},

		submit(input: unknown): boolean {
			const result = lankaYupValidator.validateSafe<TPlaygroundSignUp>(
				playgroundSignUpSchema,
				input,
			);

			if (result.success) {
				state.messages = {};
				state.value = result.data;
				return true;
			}

			state.value = null;
			state.messages = {};

			for (const field of result.fields ?? []) {
				// An EMPTY path is the value as a whole — a cross-field refusal, or a
				// body that was not the expected shape at all. It belongs at the form's
				// root, and an input named "" is not a place.
				state.messages[field.path.length > 0 ? field.path.join(".") : "form"] =
					field.message;
			}

			return false;
		},
	};
};
