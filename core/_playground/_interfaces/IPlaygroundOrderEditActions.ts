import type { IPlaygroundOrder } from "./IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "./IPlaygroundOrderInput";
import type { TPlaygroundSubmitOutcome } from "../_types/TPlaygroundSubmitOutcome";

/**
 * Everything the edit screen can do — and what the FORM may call.
 *
 * `submit` takes the values and answers the form; `checkCustomer` is the
 * asynchronous check an input needs, reachable only through here because a
 * gateway is called from a ViewModel and a form's resolver is not one.
 */
export interface IPlaygroundOrderEditActions {
	load: (id: number) => Promise<void>;
	submit: (
		values: IPlaygroundOrderInput,
		options?: { signal?: AbortSignal },
	) => Promise<TPlaygroundSubmitOutcome<IPlaygroundOrder>>;
	/** A message for the input, or `null` when the name is known. */
	checkCustomer: (name: string) => Promise<string | null>;
}
