import type { IPlaygroundOrder } from "./IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "./IPlaygroundOrderInput";
import type { TPlaygroundSubmitOutcome } from "../_types/TPlaygroundSubmitOutcome";

/** Everything the edit screen can do — and what the FORM may call. */
export interface IPlaygroundOrderEditActions {
	load: (id: number) => Promise<void>;
	submit: (values: IPlaygroundOrderInput) => Promise<TPlaygroundSubmitOutcome<IPlaygroundOrder>>;
}
