/**
 * @lankajs/plugin-relay — scenarios between applications that cannot share one
 * lanka.
 *
 * One name and its options. The envelope and the endpoint are the wire contract
 * between two copies of this package, and they stay unexported until a peer
 * that is not this package is a supported member of a channel.
 */
export { lankaRelay } from "./lanka-relay/lankaRelay";
export type { ILankaRelayOptions } from "./lanka-relay/lankaRelay";
