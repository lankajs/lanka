import { Schema } from "effect";

/**
 * An analytics module written by a team that standardised on Effect.
 *
 * Its schemas carry no `~standard` of their own, so they reach the port only
 * through `@lankajs/effect` — another dialect this application did not choose
 * and cannot avoid.
 */
export const playgroundAnalyticsSchema = Schema.Struct({
	event: Schema.String,
	at: Schema.Number,
});
