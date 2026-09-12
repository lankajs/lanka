/** Everything the list screen can do. */
export interface IPlaygroundOrdersActions {
	load: () => Promise<void>;
	/** Optimistic: the list shows the new name at once, and takes it back if the server refuses. */
	rename: (id: number, customer: string) => Promise<void>;
}
