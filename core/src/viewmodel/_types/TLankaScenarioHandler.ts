/**
 * A scenario handler, accepted bivariantly.
 *
 * The method-shorthand indirection is deliberate and cannot be simplified: under
 * `strictFunctionTypes` an arrow-typed parameter is contravariant, so a handler
 * declared for a specific payload would not satisfy the bus, which calls every
 * subscriber as `(data?: unknown) => void`. A method position is checked
 * bivariantly, which is what makes the two assignable.
 *
 * Written once here because it appeared identically in three binding types, and
 * a reader meeting `bivarianceHack` for the first time deserves to find the
 * reason rather than the trick.
 */
export type TLankaScenarioHandler<TData> = {
	bivarianceHack(data?: TData): void;
}["bivarianceHack"];
