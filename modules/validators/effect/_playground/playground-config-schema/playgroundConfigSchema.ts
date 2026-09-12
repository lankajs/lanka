import { Schema } from "effect";

/**
 * The application's start-up configuration, in Effect Schema.
 *
 * At MODULE level: the Standard Schema wrapper is cached by this object's
 * identity, and a schema rebuilt per call is a new key every time.
 */
export const playgroundConfigSchema = Schema.Struct({
	apiBase: Schema.String,
	retries: Schema.Number,
});
