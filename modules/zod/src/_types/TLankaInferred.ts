import type { z } from "zod";

/** The type a schema infers. Shorter than `z.infer<typeof schema>` everywhere. */
export type TLankaInferred<TSchema extends z.ZodType> = z.infer<TSchema>;
