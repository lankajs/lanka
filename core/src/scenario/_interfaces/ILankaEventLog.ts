/**
 * Represents a single log entry for a dispatched event.
 */
export interface ILankaEventLog {
	/** The event type name. */
	eventType: string;
	/** ISO timestamp of when the event was dispatched. */
	timestamp: string;
	/**
	 * Where this record falls in the order the bus saw events, counting from one.
	 *
	 * What `getEventLogs()` orders by, and the reason it can: a timestamp has
	 * millisecond resolution, and a burst dispatches many events inside one, so
	 * two records of one millisecond cannot be told apart by their time.
	 *
	 * Optional because a record built by anything other than the bus has no
	 * place in that order.
	 */
	sequence?: number;
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
