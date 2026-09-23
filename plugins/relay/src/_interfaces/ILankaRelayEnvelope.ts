/**
 * What one endpoint hands another: a delivered event, and who delivered it.
 *
 * The one contract two applications on two majors of this package share, which
 * is why it carries its own version: a receiver ignores a `v` it does not know
 * rather than guessing at a shape. `data` crosses BY REFERENCE — both endpoints
 * are in one realm — so a receiver that mutates it mutates the sender's.
 */
export interface ILankaRelayEnvelope {
	readonly v: number;
	/** The sending endpoint's id, never the receiver's. */
	readonly from: string;
	readonly eventType: string;
	readonly data: unknown;
	/**
	 * Set on a RETAINED value handed to an endpoint that just joined. The
	 * receiver keeps it as the event's last value, so a subscriber that arrives
	 * later — after bootstrap — and asks for replay still gets it.
	 */
	readonly retained?: true;
}
