import { type } from "arktype";

/**
 * A feature flag payload, in arktype.
 *
 * Small on purpose: this playground's subject is WHERE validation happens, not
 * how deep a schema can go. The nested shape the family asserts against lives in
 * `playgroundSignUpSchema`, which the conformance suite drives.
 */
export const playgroundFlagSchema = type({ key: "string", enabled: "boolean" });
