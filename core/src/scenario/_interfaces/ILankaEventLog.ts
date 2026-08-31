/**
 * Represents a single log entry for a dispatched event.
 */
export interface ILankaEventLog {
	/** The event type name. */
	eventType: string;
	/** ISO timestamp of when the event was dispatched. */
	timestamp: string;
	/** The payload data of the event. */
	data: unknown;
	/** Optional captured stack trace (if enabled). */
	stackTrace?: string;
	/**
	 * Why a middleware stopped delivery.
	 *
	 * Present only on stopped events; it exists so that a stop is never silent.
	 */
	stoppedBy?: string;
}
