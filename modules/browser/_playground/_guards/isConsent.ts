import type { IPlaygroundConsent } from "../_interfaces/IPlaygroundConsent";

/**
 * Whether a stored value is this application's shape.
 *
 * `lankaCookies.get` parses JSON itself and hands back the STRING when a value
 * is not JSON, so the only thing left for an application is to recognise its
 * own shape — and anything else is treated as absent rather than repaired.
 * Guessing at consent is the one thing a banner must never do.
 */
export const isConsent = (value: unknown): value is IPlaygroundConsent =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as IPlaygroundConsent).analytics === "boolean" &&
	typeof (value as IPlaygroundConsent).marketing === "boolean";
