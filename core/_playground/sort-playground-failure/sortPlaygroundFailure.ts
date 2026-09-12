import { LankaError, readLankaFieldErrors } from "../../src/errors/index";
import type { TPlaygroundSubmitFailure } from "../_types/TPlaygroundSubmitOutcome";

/**
 * Whose failure is this — the form's, or the screen's?
 *
 * Decided by `kind`, once per application, in the ViewModel layer: the form
 * does not know what a transport is, and the framework does not know which
 * refusals THIS application shows under an input. The six kinds each already say
 * what they demand of an interface; this only reads them:
 *
 * - `aborted` — the user left. Nothing anywhere.
 * - anything carrying `fields` — the form's, one message per address.
 * - `domain` without an address — the form's root: the server said no, in words.
 * - `network`, `timeout`, `http` without fields, `schema` — the screen's banner.
 *
 * This is the piece an application writes ONCE and every submit action calls.
 * `readLankaFieldErrors` is the framework's half — always a list, never a
 * throw; which kind goes where is the application's, so it lives here.
 */
export const sortPlaygroundFailure = (
	error: unknown,
	screen: (message: string) => void,
): TPlaygroundSubmitFailure => {
	if (!LankaError.is(error)) throw error;
	if (error.isSilent) return { ok: false, fields: [] };

	const fields = readLankaFieldErrors(error);
	if (fields.length > 0) return { ok: false, fields };
	if (error.kind === "domain") return { ok: false, fields: [], message: error.message };

	screen(error.message);
	return { ok: false, fields: [] };
};
