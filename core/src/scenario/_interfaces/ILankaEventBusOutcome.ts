/**
 * What became of one dispatch, after the whole chain has run.
 *
 * The counterpart of `TLankaEventBusDecision`: a middleware RETURNS a decision,
 * and the bus REPORTS an outcome. The two are deliberately symmetrical, and the
 * asymmetry that matters is that an outcome cannot change anything.
 */
export interface ILankaEventBusOutcome {
	eventType: string;
	/**
	 * Delivered to the subscribers, stopped by a middleware, or refused by the
	 * event's own schema.
	 *
	 * A union rather than an `enum`: a fourth outcome is then additive, which
	 * `skills/surface/SKILL.md` §6d.5 is about.
	 */
	outcome: "delivered" | "stopped" | "invalid";
	/**
	 * How many subscribers the event had when it was dispatched.
	 *
	 * The AUDIENCE, not the recipients: "three subscribers never heard it" is the
	 * sentence a stopped event needs, and a count that went to zero on a stop
	 * could not say it.
	 */
	subscribers: number;
	/** The reason a middleware gave, when one stopped it. */
	stoppedBy?: string;
}
