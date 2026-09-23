import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaScope } from "lanka/locator";

/** One application on the page: its framework instance, and the scope its screen lives in. */
export interface IPlaygroundApplication<TViewModel> {
	readonly lanka: ILankaInstance;
	readonly scope: ILankaScope;
	readonly viewModel: TViewModel;
}
