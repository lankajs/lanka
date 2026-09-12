import type { Static, TSchema } from "@sinclair/typebox";

/** The type a schema infers. Shorter than `Static<typeof schema>` everywhere. */
export type TLankaInferred<TSchemaType extends TSchema> = Static<TSchemaType>;
