import type { ILankaInstance } from "lanka/bootstrap";

/** The delivery an endpoint is making right now, so it is not sent back. */
export interface ILankaRelayInFlight {
	readonly eventType: string;
	readonly data: unknown;
}

/** What the medium half of an endpoint does for the rest of it. */
export interface ILankaRelayMediumLink {
	/** Posts one delivered event to the other realms. */
	postEvent: (eventType: string, data: unknown, at: number) => void;
	/** Stops hearing the medium. */
	leave: () => void;
}

/**
 * One application's place on a channel: what it may send, receive and retain,
 * the delivery it is making right now, and — with a transport — what it has
 * heard from other realms.
 *
 * One object shared by the endpoint, the observer and the medium, because they
 * are three views of one exchange: the observer must know what the endpoint is
 * delivering, or it would send that delivery straight back.
 */
export interface ILankaRelayState {
	readonly lanka: ILankaInstance;
	readonly channel: string;
	readonly id: string;
	readonly send: ReadonlySet<string>;
	readonly receive: ReadonlySet<string>;
	readonly retain: ReadonlySet<string>;
	/** Event type → the last value delivered here, and when on the page's clock. */
	readonly retained: Map<string, { readonly data: unknown; readonly at: number }>;
	inFlight: ILankaRelayInFlight | null;
	/** The other realms, when a transport was given; `null` on the page alone. */
	medium: ILankaRelayMediumLink | null;
	/** The last frame number this endpoint posted. */
	seq: number;
	/** Sender id → the last frame number heard from it. */
	readonly heard: Map<string, number>;
	/**
	 * Event type → how new the value this endpoint shows is: the stamp of a value
	 * handed over or answered, and `Infinity` once a LIVE delivery arrived. A
	 * retained answer is taken only if it is strictly newer — so a late answer
	 * never moves a screen backwards.
	 */
	readonly known: Map<string, number>;
}
