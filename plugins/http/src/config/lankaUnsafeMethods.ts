/**
 * Methods that change state on the server.
 *
 * The list every policy that must distinguish a read from a write branches on:
 * CSRF adds its header to these, idempotency requires a key for these, and retry
 * refuses to repeat one without that key.
 */
export const lankaUnsafeMethods: readonly string[] = ["POST", "PUT", "PATCH", "DELETE"];
