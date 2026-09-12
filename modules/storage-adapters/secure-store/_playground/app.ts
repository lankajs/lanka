/**
 * A vault on a device, and a keychain that refuses what a keychain refuses.
 *
 * The engine is the fixture and the adapter is the subject. The application
 * names its keys the way applications do — with a space, with a slash — and
 * never learns that the device would not have taken them.
 */
export { createPlaygroundKeychain } from "./create-playground-keychain/createPlaygroundKeychain";
export { createPlaygroundVault } from "./create-playground-vault/createPlaygroundVault";
