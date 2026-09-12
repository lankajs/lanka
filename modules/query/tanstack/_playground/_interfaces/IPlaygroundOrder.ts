/** An order, as the server holds it. */
export interface IPlaygroundOrder {
	id: number;
	customer: string;
	/** The server's version, so a screen can tell its own save from somebody else's. */
	updatedAt: number;
}
