import { LankaError, readLankaFieldErrors } from "lanka/errors";
import type { ILankaFieldError } from "lanka/errors";

/**
 * What a submit answers, in a shape a form can act on.
 *
 * `ok: false` with an empty `fields` and no `message` is a real outcome: the
 * call was aborted, and the form should do nothing at all.
 */
export type TAtlasSubmitOutcome<TData> =
	| { ok: true; data: TData }
	| { ok: false; fields: readonly ILankaFieldError[]; message?: string };

/**
 * Sends each kind of failure where it belongs, and never to two places.
 *
 * The order is the decision, and it is the application's rather than the
 * framework's — which is why the framework publishes the READING
 * (`readLankaFieldErrors`) and leaves this to be written once per project:
 *
 * 1. **not ours** — rethrown. A `TypeError` from a bug is not a message.
 * 2. **silent** — the user cancelled. Nothing is shown, anywhere.
 * 3. **it has an address** — the fields go to the form, under the inputs.
 * 4. **a deliberate refusal** — the server's own sentence, shown on the form.
 * 5. **everything else** — network, timeout, 5xx, schema: the SCREEN's, because
 *    no input is responsible for the connection.
 *
 * The addresses arrive in segments, and they stay that way: one form library
 * writes `items.1.qty`, another `items[1].qty`, and a joined string cannot be
 * taken apart again — a message may contain a colon, a key may contain a dot.
 */
export const sortAtlasSubmitFailure = <TData>(
	failure: unknown,
	toScreen: (message: string) => void,
): TAtlasSubmitOutcome<TData> => {
	if (!LankaError.is(failure)) throw failure;
	if (failure.isSilent) return { ok: false, fields: [] };

	const fields = readLankaFieldErrors(failure);
	if (fields.length > 0) return { ok: false, fields };

	if (failure.kind === "domain") return { ok: false, fields: [], message: failure.message };

	toScreen(failure.message);

	return { ok: false, fields: [] };
};
