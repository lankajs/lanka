/**
 * What was already done under a key, so doing it again does nothing new.
 *
 * The half of the contract a server owes a retrying client. `@lankajs/plugin-http`
 * mints one key per INTENT and sends it on every attempt, which only prevents a
 * second payment if the server remembers the first — so this is the other side
 * of the reason that plugin refuses retry without idempotency at all.
 */
export class AtlasIdempotency<TResult> {
	private readonly done = new Map<string, TResult>();

	/**
	 * Runs the work, or answers what the same key produced before.
	 *
	 * A key of `undefined` — a client that sent none — runs every time. Treating
	 * the absence as a key would collapse every unkeyed request into one answer,
	 * which is a far worse failure than the one being prevented.
	 */
	public once(key: string | undefined, work: () => TResult): TResult {
		if (key === undefined) return work();

		const remembered = this.done.get(key);
		if (remembered !== undefined) return remembered;

		const result = work();
		this.done.set(key, result);

		return result;
	}

	/** Whether this key has been spent. The board's diagnostics read it. */
	public knows(key: string): boolean {
		return this.done.has(key);
	}
}
