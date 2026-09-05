/**
 * Called after a connection is re-established, never on the first one.
 *
 * No arguments deliberately: the one fact it carries is "there is a gap in what
 * you were told", and nothing about the gap is knowable from this side.
 */
export type TLankaStreamReconnectCallback = () => void;
