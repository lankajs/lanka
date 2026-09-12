/** What a list screen shows: the rows it could read, and what it could not. */
export interface IPlaygroundListState {
	rows: { sku: string; qty: number }[];
	/** One line per refused row, addressed by its INDEX in the page. */
	refused: string[];
}
