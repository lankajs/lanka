/**
 * @lankajs/mmkv — MMKV behind the framework's storage port.
 *
 * ## When to install it
 *
 * On a device, and first. MMKV is the only engine that answers without
 * awaiting, which is what a persisted store read during the first render needs:
 * an engine that must be awaited renders once without the value and again with
 * it, and that flash is what a user sees instead of a load.
 *
 * Where a value must survive the application being uninstalled, or must sit
 * behind the device's own lock, the answer is `@lankajs/secure-store` — a
 * keychain, not a faster key-value store. The two are installed together more
 * often than either is installed alone.
 *
 * ## What this package is not
 *
 * It is not MMKV, and it does not depend on MMKV. The engine is handed in, which
 * keeps the vendor out of this package's dependencies, lets an application keep
 * a second instance with its own id, and makes the adapter testable off the
 * device. `ILankaMmkvEngine` is the shape it expects, and the conformance suite
 * runs against a double of it.
 *
 * ## Both majors
 *
 * v4 moved to Nitro and renamed two things; v3 is what most applications have
 * installed. The adapter asks the instance which delete it has rather than
 * trusting a version range — the range is what the consumer wrote, the instance
 * is what they got.
 */

export { LankaMmkvAdapter } from "./lanka-mmkv-adapter/LankaMmkvAdapter";
export { createLankaMmkvAdapter } from "./_factories/create-lanka-mmkv-adapter/createLankaMmkvAdapter";
export type { ILankaMmkvEngine } from "./_interfaces/ILankaMmkvEngine";
