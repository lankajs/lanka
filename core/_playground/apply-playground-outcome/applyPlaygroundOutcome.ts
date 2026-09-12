import type { IPlaygroundForm } from "../_interfaces/IPlaygroundForm";
import type { TPlaygroundSubmitOutcome } from "../_types/TPlaygroundSubmitOutcome";

/**
 * The three lines between a ViewModel's answer and a form library.
 *
 * The only place that knows how THIS form spells an address — dots here, as
 * React Hook Form does; TanStack Form would write `items[1].qty` — which is why
 * the ViewModel hands over segments and never a string. Written once per
 * application, beside the form library it adapts.
 */
export const applyPlaygroundOutcome = <TValues extends object, TData>(
	form: IPlaygroundForm<TValues>,
	outcome: TPlaygroundSubmitOutcome<TData>,
): void => {
	if (outcome.ok) {
		// Saved: what is on the screen is now what the server has.
		form.reset(form.values);
		return;
	}

	for (const field of outcome.fields) {
		// An empty path is the value as a whole — the root, never an input named "".
		form.setError(field.path.length === 0 ? "root" : field.path.join("."), field.message);
	}
	if (outcome.message) form.setError("root", outcome.message);
};
