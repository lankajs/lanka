/** One line of an order: what, and how many. */
export interface IPlaygroundOrderItem {
	sku: string;
	qty: number;
}

/**
 * An order as the server holds it — the DOMAIN shape.
 *
 * `id` and `updatedAt` are the server's to assign, which is what separates this
 * from `IPlaygroundOrderInput`: a form never edits them, and a cache must never
 * be handed an object without them.
 */
export interface IPlaygroundOrder {
	id: number;
	customer: string;
	items: IPlaygroundOrderItem[];
	updatedAt: number;
}
