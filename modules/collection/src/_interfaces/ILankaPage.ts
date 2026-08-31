/** One page of a list, and how many there are. */
export interface ILankaPage<TItem> {
	items: readonly TItem[];
	totalPages: number;
}
