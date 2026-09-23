/**
 * @lankajs/plugin-relay — scenarios between applications that cannot share one
 * lanka.
 *
 * One name and its options, and the transport that takes a channel past the
 * page: the port an application implements, and the one medium this package
 * ships. The envelope, the endpoint and the frame are the wire contract between
 * copies of this package, and they stay unexported until a peer that is not
 * this package is a supported member of a channel.
 */
export { lankaRelay } from "./lanka-relay/lankaRelay";
export type { ILankaRelayOptions } from "./lanka-relay/lankaRelay";
export { createLankaRelayBroadcastChannelTransport } from "./_factories/create-lanka-relay-broadcast-channel-transport/createLankaRelayBroadcastChannelTransport";
export type { ILankaRelayTransport } from "./_interfaces/ILankaRelayTransport";
