import type { ILankaRelayEndpoint } from "../../_interfaces/ILankaRelayEndpoint";

/**
 * The channels on this page, and who is on each.
 *
 * On the global object because it is the one place two copies of this package
 * — one per application bundle — can both reach, under a name each agrees on
 * without importing anything. One key for every version: the value says which
 * version wrote it, where a key per version would make two versions miss each
 * other with no error at all.
 */
interface ILankaRelayRegistry {
	readonly v: number;
	readonly channels: Map<string, Set<ILankaRelayEndpoint>>;
}

const KEY = Symbol.for("lanka.relay");

const registry = (): ILankaRelayRegistry => {
	const global = globalThis as Record<symbol, ILankaRelayRegistry | undefined>;
	return (global[KEY] ??= { v: 1, channels: new Map() });
};

/**
 * Puts an endpoint on a channel, after every endpoint already there has handed
 * it what it retains. Returns the call that takes it off again.
 */
const join = (channel: string, endpoint: ILankaRelayEndpoint): (() => void) => {
	const { channels } = registry();
	const members = channels.get(channel) ?? new Set<ILankaRelayEndpoint>();

	for (const member of members) member.greet(endpoint);

	members.add(endpoint);
	channels.set(channel, members);

	return () => {
		members.delete(endpoint);
		if (members.size === 0) channels.delete(channel);
	};
};

/** Everyone on the channel except `self`, as a copy: delivery may change the set. */
const peers = (channel: string, self: ILankaRelayEndpoint): ILankaRelayEndpoint[] =>
	[...(registry().channels.get(channel) ?? [])].filter((member) => member !== self);

/** The page's channels, as one table: joining and finding peers are one subject. */
export const lankaRelayChannels = Object.freeze({ join, peers });
