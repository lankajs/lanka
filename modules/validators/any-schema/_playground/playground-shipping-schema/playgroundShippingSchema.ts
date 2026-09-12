import { object, string, number, min, integer } from "superstruct";

/**
 * A shipping quote, in superstruct — a library with no package in
 * `modules/validators/`.
 *
 * The fifth dialect this application needs, and the reason the hub takes custom
 * ones. superstruct publishes no `~standard`, no `validateSync`, no TypeBox
 * `Kind` and no Effect marker, so the built-in table calls it unknown and is
 * right to: recognising a library nobody registered would be guessing.
 *
 * Nothing in lanka had to change for this to work. That is the test.
 */
export const playgroundShippingSchema = object({
	carrier: string(),
	days: min(integer(), 1),
	priceCents: min(number(), 0),
});
