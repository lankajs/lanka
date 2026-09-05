import type { TLankaStreamEventCallback } from "../_types/TLankaStreamEventCallback";

/**
 * A bridge's protected surface, handed to whoever writes one by calling.
 *
 * The names match `ALankaStreamBridge`'s protected members exactly: a consumer
 * who switches styles moves `this.on(...)` to `on(...)` and changes nothing
 * else. Checked by `scripts/check-parity.mjs`.
 */
export interface ILankaStreamBridgeContext {
	/** Subscribes to an event type; the handler runs with the "from outside" marker. */
	on: (eventType: string, handler: TLankaStreamEventCallback) => void;

	/** The same for an event with no payload. */
	onSignal: (eventType: string, handler: () => void) => void;

	/** Catch-up for what was missed while disconnected. */
	onReconnect: (handler: () => void) => void;
}
