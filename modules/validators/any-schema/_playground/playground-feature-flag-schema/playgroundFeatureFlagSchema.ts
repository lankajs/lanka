import { type } from "arktype";

/**
 * A feature flag payload, in arktype.
 *
 * Here for a specific reason: an arktype schema is a FUNCTION, not an object.
 * Anything deciding "is this a schema" by `typeof schema === "object"` calls it
 * unknown, and the application loses a feature with an error naming the wrong
 * library. The dialect table reads the marker instead, and this schema is what
 * proves it.
 */
export const playgroundFeatureFlagSchema = type({ key: "string", enabled: "boolean" });
