/** One thing that happened, named the way every wire here names it. */
export interface IAtlasChange {
	/** `mission.completed`, `mission.assigned`, `crew.said`. */
	type: string;
	payload: Record<string, unknown>;
}

/** Called for every change, until the returned function is called. */
export type TAtlasChangeListener = (change: IAtlasChange) => void;

/**
 * The one place a change is announced, and the four wires that carry it.
 *
 * Server-sent events, the WebSocket board, the GraphQL subscription and the gRPC
 * server stream are four encodings of the SAME facts. Each subscribing to the
 * world separately would let them drift — three of them would be updated when a
 * fact changed shape and the fourth would be found months later — so they all
 * read this.
 */
export class AtlasChanges {
	private readonly listeners = new Set<TAtlasChangeListener>();

	/** Subscribes, and answers the way to stop. */
	public listen(listener: TAtlasChangeListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Announces a change to everyone listening.
	 *
	 * Over a COPY of the set: a listener may unsubscribe itself while being
	 * called — a socket that closes on the frame it just received does exactly
	 * that — and iterating the live set would then skip its neighbour.
	 */
	public announce(type: string, payload: Record<string, unknown>): void {
		for (const listener of [...this.listeners]) listener({ type, payload });
	}

	/** How many are listening. The board's own diagnostics read it. */
	public listenerCount(): number {
		return this.listeners.size;
	}
}
