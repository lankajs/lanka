import type { TPlaygroundSignUp } from "../playground-sign-up-schema/playgroundSignUpSchema";

/** What a form shows: a value once it is valid, and messages until it is. */
export interface IPlaygroundFormState {
	value: TPlaygroundSignUp | null;
	fieldErrors: string[];
}
