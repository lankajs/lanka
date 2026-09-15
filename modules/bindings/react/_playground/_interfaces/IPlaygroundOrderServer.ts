/** What the fake server refuses, and how it answers when it does not. */
export interface IPlaygroundOrderServer {
	/** Lines the server has no stock for, by index, with the message it sends. */
	refusals?: Record<number, string>;
	/** Rejects the whole save with no address — a form-wide message. */
	refuseWith?: string;
}
