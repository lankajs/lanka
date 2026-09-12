import type { Type } from "arktype";

/** The type a schema infers. Shorter than `typeof schema.infer` everywhere. */
export type TLankaInferred<TSchema extends Type> = TSchema["infer"];
