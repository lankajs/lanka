/**
 * A device application that decides its first screen before it renders one.
 *
 * The engine is the fixture and the adapter is the subject: `createPlaygroundMmkv`
 * stands in for a native module in both of the shapes it ships, and
 * `createPlaygroundDeviceSession` is ordinary application code that never learns
 * which of them it got.
 */
export { createPlaygroundMmkv } from "./create-playground-mmkv/createPlaygroundMmkv";
export { createPlaygroundDeviceSession } from "./create-playground-device-session/createPlaygroundDeviceSession";
