import type { TPlaygroundSignUp } from "../playground-sign-up-schema/playgroundSignUpSchema";

/**
 * What a screen holds: the value once it is valid, and a message PER INPUT.
 *
 * Keyed by the joined path rather than carrying a flat list, because that is the
 * shape a screen actually indexes: an input asks "is there a message for me?"
 * and must not scan a list to find out.
 */
export interface IPlaygroundScreenState {
	value: TPlaygroundSignUp | null;
	messages: Record<string, string>;
}
