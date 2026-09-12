import type { InferType, ISchema } from "yup";

/** The type a schema infers. Shorter than `InferType<typeof schema>` everywhere. */
export type TLankaInferred<TSchema extends ISchema<unknown>> = InferType<TSchema>;
