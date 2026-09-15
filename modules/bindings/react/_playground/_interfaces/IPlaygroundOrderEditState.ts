import type { IPlaygroundOrder } from "./IPlaygroundOrder";

/** What the edit screen can read: the server's version, and what went wrong. */
export interface IPlaygroundOrderEditState {
	server: IPlaygroundOrder | null;
	screenError: string | null;
}
