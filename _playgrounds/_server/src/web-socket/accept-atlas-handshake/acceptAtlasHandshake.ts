import { createHash } from "node:crypto";

/**
 * The constant every WebSocket handshake appends before hashing.
 *
 * It is in the specification and it is the same for everyone: it exists so that
 * a server which merely echoes the key cannot be mistaken for one that
 * implements the protocol, not as a secret.
 */
const HANDSHAKE_SALT = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** The `Sec-WebSocket-Accept` value for a client's key. */
export const acceptAtlasHandshake = (key: string): string =>
	createHash("sha1")
		.update(key + HANDSHAKE_SALT)
		.digest("base64");
