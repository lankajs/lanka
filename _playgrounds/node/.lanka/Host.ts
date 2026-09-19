/**
 * What this application supplies to `lanka` — next door.
 *
 * `Host.ts` is one VALUE, so it cannot be sharded: there is no union of two
 * hosts. What it can do is live in the other directory, which is the second
 * kind of split this application carries. `@lanka_di/Host` resolves HERE, so
 * this file is what the framework opens, and the line below is how it reaches
 * the declaration in `.lanka_di/Host.ts`.
 *
 * This is the file `@lankajs/tool-di` writes on the first build of a layout like
 * this one, kept by hand here so a reader meets the split rather than inferring
 * it from a resolver.
 */
export * from "../.lanka_di/Host";
