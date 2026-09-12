import type { IPlaygroundOrder } from "./IPlaygroundOrder";

/** What the list screen reads: the resource, and the two things a cache does not carry for it. */
export interface IPlaygroundOrdersState {
	orders: IPlaygroundOrder[];
	isLoading: boolean;
	screenError: string | null;
}
