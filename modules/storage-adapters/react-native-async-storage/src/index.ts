/**
 * @lankajs/react-native-async-storage — AsyncStorage behind the framework's
 * storage port.
 *
 * ## When to install it
 *
 * When the application already has it. `@react-native-async-storage/async-storage`
 * is what most React Native projects reached for first, and this package is how
 * that keeps working while everything above it is written against the port.
 *
 * For a value read during the first render, reach for `@lankajs/mmkv` instead:
 * nothing crossing the bridge can answer before the next tick, so a persisted
 * store over this engine renders once without its value.
 *
 * ## Why the name is this long
 *
 * The port's asynchronous half is `ILankaAsyncStorageAdapter`. A class called
 * `LankaAsyncStorageAdapter` beside it would read as that interface's
 * implementation rather than as a binding of one library — two names differing
 * by an `I` and meaning different things. The package is named after the npm
 * package it binds instead.
 *
 * ## What this package is not
 *
 * It is not AsyncStorage, and it does not depend on it: the engine is handed in.
 * That keeps the vendor out of this package's dependencies and makes the adapter
 * testable off the device, where a native module cannot run at all.
 */

export { LankaReactNativeAsyncStorageAdapter } from "./lanka-react-native-async-storage-adapter/LankaReactNativeAsyncStorageAdapter";
export { createLankaReactNativeAsyncStorageAdapter } from "./_factories/create-lanka-react-native-async-storage-adapter/createLankaReactNativeAsyncStorageAdapter";
export type { ILankaReactNativeAsyncStorageEngine } from "./_interfaces/ILankaReactNativeAsyncStorageEngine";
