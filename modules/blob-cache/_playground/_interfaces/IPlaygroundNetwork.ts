/** The wire, stated as data: what answers, and what was actually asked for. */
export interface IPlaygroundNetwork {
	/** Every URL actually fetched, in order. */
	readonly fetched: string[];
	/** Hosts that answer, keyed by URL. */
	answers: Map<string, Blob>;
}
