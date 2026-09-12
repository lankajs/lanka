import type { ILankaAsyncStorageAdapter } from "./ILankaAsyncStorageAdapter";
import type { ILankaSyncStorageAdapter } from "./ILankaSyncStorageAdapter";

/**
 * What a key-value engine must do to stand behind `@lankajs/storage`.
 *
 * A PORT and nothing else: core declares the shape and ships no engine, because
 * every platform already has one and they have nothing in common but these four
 * operations. The asynchronous half is the whole port; the synchronous half is a
 * capability an engine either has or does not, and a caller asks before using it
 * rather than forcing the type.
 *
 * Implementations: `@lankajs/storage` carries three over what a browser already
 * provides — `LankaWebStorageAdapter`, `LankaCacheStorageAdapter`,
 * `LankaIndexedDbAdapter` — and `modules/storage-adapters/` holds one per engine
 * an application installs. An application is free to write its own; the
 * conformance suite in `@lankajs/tool-testing` is what says whether it is right.
 *
 * ## The clauses an implementation must keep
 *
 * Behaviour, not signatures, is where two honest adapters diverge, so each
 * clause below is a promise and every one of them is an assertion in
 * `lankaStorageAdapterConformance`. Run it; do not read a member's source.
 *
 * 1. Values are STRINGS, and what was written comes back byte for byte — `""`,
 *    `"null"` and `"{}"` included. An engine that serialises on the way in and
 *    parses on the way out answers a different type than it was given.
 * 2. A missing key answers `null` — never `undefined`, never a throw.
 * 3. `removeItem` of a key that is not there succeeds.
 * 4. `setItem` over an existing key replaces it. Nothing merges.
 * 5. `clear()` empties this adapter's NAMESPACE: afterwards every key it wrote
 *    answers `null`.
 * 6. `keys()` is optional. Declared, it answers what this adapter wrote and
 *    nothing else — the namespace's keys, not the engine's.
 * 7. An engine that can neither enumerate nor wipe keeps its own index of what
 *    it wrote, so clause 5 holds anyway. `expo-secure-store` is the reason this
 *    clause exists: it deletes a key it is handed and offers nothing else.
 * 8. The synchronous half is all four methods or none.
 * 9. The two halves see ONE store: a value written synchronously is visible to
 *    `getItem`, and the other way round.
 * 10. A value the engine cannot hold FAILS. Truncation surfaces a week later as
 *     a token that decrypts to nonsense.
 * 11. A key is used AS GIVEN. A key holding a space, a slash, a colon or a
 *     letter outside ASCII names its own value, and `keys()` answers it in the
 *     spelling it was written with. An engine that restricts which characters a
 *     key may hold — `expo-secure-store` allows only letters, digits, `.`, `-`
 *     and `_` — encodes on the way in and decodes on the way out, rather than
 *     handing the caller a key it never wrote.
 *
 * ## Why `clear()` is required where `ILankaReadCache.cancel` is optional
 *
 * The port next door made an operation optional when three of four libraries
 * could not do it. This one does the opposite with the same kind of gap, and the
 * difference is what absence COSTS. A cache that cannot cancel finishes a
 * request nobody wants: wasteful, never wrong. A store that cannot clear ends a
 * session with the tokens still in it — which is not waste, it is the failure.
 *
 * So the cost lands on the one adapter with the problem (clause 7) instead of on
 * every caller having to ask whether sign-out worked.
 *
 * ## What this port does not decide
 *
 * Three promises cannot be observed from inside an implementation and belong to
 * whoever wires one:
 *
 * - **The adapter takes its engine, and never constructs it.** `new
 *   LankaWebStorageAdapter(localStorage)` is the existing shape and the reason
 *   an engine that only exists on a device is testable in node at all.
 * - **An engine that encrypts itself is not encrypted twice.** MMKV with a key
 *   and a keychain-backed store are already ciphertext at rest;
 *   `LankaEncryptedStorage` over one of them is a second lock on one door.
 * - **On a server the namespace is per REQUEST**, never a module-level
 *   singleton — one process serves every reader.
 */
export interface ILankaStorageAdapter
	extends ILankaAsyncStorageAdapter, Partial<ILankaSyncStorageAdapter> {}
