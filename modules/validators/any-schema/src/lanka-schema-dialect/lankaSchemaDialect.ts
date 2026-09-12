import type { TLankaSchemaDialect } from "../_types/TLankaSchemaDialect";

/**
 * Which dialect a schema belongs to, decided by SHAPE alone.
 *
 * ## Why shape and not `instanceof`
 *
 * This package has no dependency on any schema library — that is the point of
 * it: an application pays only for the libraries it actually installed, and a
 * hub importing all six would make every consumer install all six. So each
 * dialect is recognised by the marker its library puts on every schema, which is
 * also what each vendor package's own guard reads.
 *
 * `instanceof` would be worse even with the dependency: a duplicate copy of a
 * library in a dependency tree produces schemas that fail `instanceof` and work
 * perfectly, and a hub refusing those would be inventing a problem.
 *
 * ## The order is not alphabetical, and cannot be
 *
 * **yup before standard.** A yup schema carries `~standard` — yup implements the
 * specification — but its `validate` is `async`, so the synchronous port refuses
 * every one of them. Asked in the other order, every yup schema would be called
 * "standard" and routed to a validator that cannot run it.
 *
 * The rest are disjoint, and the order between them is only a reading order.
 */
const KIND = Symbol.for("TypeBox.Kind");

/** Something a marker can be read off: an object, or a callable — arktype's is. */
const isIndexable = (schema: unknown): schema is Record<string | symbol, unknown> => {
	if (schema === null || schema === undefined) return false;

	return typeof schema === "object" || typeof schema === "function";
};

export const lankaSchemaDialect = (schema: unknown): TLankaSchemaDialect => {
	if (!isIndexable(schema)) return "unknown";

	// Before `standard`: a yup schema carries `~standard` and cannot be run
	// through it. See the header.
	if (typeof schema.validateSync === "function") return "yup";
	if (KIND in schema) return "typebox";
	// Effect's marker, read rather than imported. `Schema.isSchema` asks for the
	// same symbol, and asking for it here keeps the peer dependency out.
	if (Symbol.for("effect/Schema") in schema) return "effect";
	if ("~standard" in schema) return "standard";

	return "unknown";
};
