import { Schema } from "effect";

/**
 * What a telemetry frame is, written in **Effect Schema** — the fourth dialect.
 *
 * Effect's Standard Schema lives behind a function rather than on the schema
 * object, so nothing that looks for the `~standard` property finds it. Four
 * dialects is therefore a fact about how these libraries publish themselves,
 * not a taxonomy somebody invented.
 */
export const atlasTelemetrySchema = Schema.Struct({
	kind: Schema.String,
	queued: Schema.Number,
	active: Schema.Number,
	done: Schema.Number,
});
