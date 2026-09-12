import type { Schema } from "effect";

/** The type a schema infers. Shorter than `Schema.Schema.Type<typeof schema>` everywhere. */
export type TLankaInferred<TAlias extends Schema.Schema.AnyNoContext> = Schema.Schema.Type<TAlias>;
