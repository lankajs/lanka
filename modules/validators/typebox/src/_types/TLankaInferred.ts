import type { StaticDecode, TSchema } from "typebox";

/**
 * The type a schema infers: what `validate` returns.
 *
 * `StaticDecode` rather than `Static`, which in TypeBox 1.x is the ENCODED
 * side — the wire shape a codec reads, not the value it produces.
 */
export type TLankaInferred<TSchemaType extends TSchema> = StaticDecode<TSchemaType>;
