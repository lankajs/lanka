/**
 * What a subscriber is handed when a named event arrives.
 *
 * A record rather than a generic: the transport parsed bytes and knows nothing
 * about what they mean, and a bridge is the layer that names the shape. Typing
 * it here would be the transport asserting something it did not check.
 */
export type TLankaStreamEventCallback = (payload: Record<string, unknown>) => void;
