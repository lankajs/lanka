/**
 * The backend, written down before the test runs.
 *
 * Status PER ATTEMPT rather than one status: a retry that cannot succeed after a
 * failure proves only that a request was repeated.
 */
export interface IPlaygroundServerScript {
	statuses: number[];
	body?: unknown;
	/** Every request the transport actually saw. */
	readonly seen: { endpoint: string; options?: RequestInit }[];
}
