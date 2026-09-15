/**
 * Replaces a list's children with one element per row.
 *
 * The whole of "rendering" in this application, and it is eight lines. What a
 * framework adds on top of this is not the DOM call — it is deciding WHEN to
 * make it, and that decision is what `subscribe` and the access tracker already
 * answer.
 */
export const renderAtlasList = <TRow>(
	list: HTMLElement,
	rows: readonly TRow[],
	toText: (row: TRow) => string,
): void => {
	list.replaceChildren(
		...rows.map((row) => {
			const item = document.createElement("li");
			item.textContent = toText(row);

			return item;
		}),
	);
};
