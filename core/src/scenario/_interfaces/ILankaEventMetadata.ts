/**
 * Metadata describing an event type.
 */
export interface ILankaEventMetadata {
	/** Expected data type name (informational only). */
	dataType?: string;
	/** Human-readable description of the event. */
	description?: string;
	/** List of modules/components using this event. */
	usedBy?: string[];
	/** Optional validation schema for event data. */
	schema?: (data: unknown) => boolean;
	/** Default subscription priority (higher = earlier execution). */
	priority?: number;
	/** Maximum number of logs to keep for this event. */
	maxLogs?: number;
	/**
	 * How many recent values are kept for late subscribers.
	 *
	 * Declared on the EVENT, not merely requested by a subscriber: an event may
	 * fire before anyone subscribes, and only the event's own declaration can
	 * have caused the value to be retained by then.
	 *
	 * Default is to keep nothing — a buffer that is on by default retains
	 * payloads no one asked for.
	 */
	replay?: boolean | "last" | number;
}
