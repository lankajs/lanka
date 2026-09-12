/**
 * @lankajs/secure-store — the device's keychain behind the framework's storage
 * port.
 *
 * ## When to install it
 *
 * For the values that must not sit in a fast key-value store: a session token, a
 * refresh token, a secret an application holds on the user's behalf. The
 * keychain is slower than MMKV by a wide margin and holds about two kilobytes a
 * row — it is not the engine for preferences, and an application that installs
 * it usually installs `@lankajs/mmkv` beside it.
 *
 * ## The one that bends the port
 *
 * `expo-secure-store` publishes three calls: read, write, delete. The port asks
 * for `clear()` and `keys()`, and a sign-out needs both. It also restricts which
 * characters a key may hold, and refuses values above its ceiling.
 *
 * So this adapter keeps an INDEX of what it wrote, encodes keys on the way in
 * and decodes them on the way out, and refuses a value the platform would
 * truncate. Four clauses of the port, paid here rather than in every application
 * that reaches for a keychain — and the reason the clauses are worth stating is
 * that each of them fails silently when nobody does.
 *
 * ## What this package is not
 *
 * It is not `expo-secure-store` and does not depend on it: the engine is handed
 * in. An application needing a keychain service, an access group or a prompt
 * wraps the engine before passing it, which keeps this package from growing a
 * passthrough for options it cannot test.
 */

export { LankaSecureStoreAdapter } from "./lanka-secure-store-adapter/LankaSecureStoreAdapter";
export { createLankaSecureStoreAdapter } from "./_factories/create-lanka-secure-store-adapter/createLankaSecureStoreAdapter";
export type { ILankaSecureStoreEngine } from "./_interfaces/ILankaSecureStoreEngine";
