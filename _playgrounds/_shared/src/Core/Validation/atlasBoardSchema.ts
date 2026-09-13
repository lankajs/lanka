import { Type } from "@sinclair/typebox";

/**
 * What the board summarises, written in **TypeBox** — the third dialect.
 *
 * TypeBox publishes no Standard Schema at all: it is JSON Schema with types
 * attached, and nothing in it answers `~standard`. A hub recognises it by
 * TypeBox's own `Kind` marker rather than by `instanceof`, because a duplicate
 * copy of a library in a dependency tree produces values that fail `instanceof`
 * and work perfectly.
 */
export const atlasBoardSchema = Type.Object({
	queued: Type.Integer({ minimum: 0 }),
	active: Type.Integer({ minimum: 0 }),
	forecast: Type.Union([Type.String(), Type.Null()]),
});
