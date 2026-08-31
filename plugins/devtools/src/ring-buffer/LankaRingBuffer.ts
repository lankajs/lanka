/**
 * A ring buffer with a KNOWN bound.
 *
 * An inspector accumulating without a limit is a leak with a user interface: it
 * looks like diagnostics and behaves as slow memory growth, visible only in a
 * long session.
 */
export class LankaRingBuffer<TItem> {
	private readonly items: TItem[] = [];

	private readonly limit: number;

	public constructor(limit: number) {
		this.limit = limit;
	}

	public push(item: TItem): void {
		this.items.push(item);
		if (this.items.length > this.limit) this.items.shift();
	}

	public toArray(): readonly TItem[] {
		return [...this.items];
	}

	public clear(): void {
		this.items.length = 0;
	}
}
