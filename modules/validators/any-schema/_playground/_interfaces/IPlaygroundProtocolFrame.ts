/**
 * A frame of the partner's protocol, as this application holds it.
 *
 * Its own file because it is a CONTRACT with somebody outside the codebase, and
 * the schema that reads it is written by hand — so there is no library type to
 * infer it from. That is the trade `createLankaSchema` makes: no dependency, and
 * the type is stated rather than derived.
 */
export interface IPlaygroundProtocolFrame {
	readonly kind: "ping" | "pong";
	readonly sequence: number;
	readonly sentAt: Date;
}
