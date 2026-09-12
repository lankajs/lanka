import { LankaError } from "../lanka-error/LankaError";
import type { ILankaFieldError } from "../_interfaces/ILankaFieldError";

const NONE: readonly ILankaFieldError[] = Object.freeze<ILankaFieldError[]>([]);

/**
 * The part of a failure that has an input to be shown at — or nothing.
 *
 * Always a list, never a throw and never `undefined`: the caller is a ViewModel
 * deciding what to hand a form, and it writes `for … of` without a guard,
 * whatever it caught. A foreign error has no fields; neither has a network
 * failure; a schema refusal and a 422 the request policy parsed have some. The
 * empty answer is one frozen list, so a caller that mutates what it was given
 * finds out at once rather than in another caller's screen.
 *
 * What is NOT here: deciding where the REST of the failure goes. Whether a
 * `domain` refusal is the form's root message or the screen's banner differs
 * per screen, so that sorting stays in the ViewModel — the guide shows the
 * shape — the way `lankaFirstOf` publishes the folding of extractors and leaves
 * their order to the application.
 */
export const readLankaFieldErrors = (error: unknown): readonly ILankaFieldError[] =>
	LankaError.is(error) ? (error.fields ?? NONE) : NONE;
