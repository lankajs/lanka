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
	/** The page's clock for retained values: higher is newer, whoever holds it. */
	clock: number;
}

const KEY = Symbol.for("lanka.relay");

const registry = (): ILankaRelayRegistry => {
	const global = globalThis as Record<symbol, ILankaRelayRegistry | undefined>;
	return (global[KEY] ??= { v: 1, channels: new Map(), clock: 0 });
};

/** The next tick of the page's clock, for a value an endpoint is about to retain. */
const stamp = (): number => (registry().clock += 1);

/**
 * For each retained event type, the ONE member holding the newest value.
 *
 * Several applications may retain one type — the one that announced it, and
 * any that were handed it — and a newcomer is owed the page's last fact about
 * it, once. Handing over from every holder would deliver one fact twice; from
 * an arbitrary one, possibly a stale one.
 */
const newestHolders = (
	members: Iterable<ILankaRelayEndpoint>,
): Map<string, ILankaRelayEndpoint> => {
	const newest = new Map<string, { holder: ILankaRelayEndpoint; at: number }>();

	for (const member of members) {
		for (const [eventType, at] of member.retained()) {
			const current = newest.get(eventType);
			if (!current || at > current.at) newest.set(eventType, { holder: member, at });
		}
	}

	return new Map([...newest].map(([eventType, { holder }]) => [eventType, holder]));
};

/**
 * Puts an endpoint on a channel, after it has been handed the newest retained
 * value of every type, once each. Returns the call that takes it off again.
 */
const join = (channel: string, endpoint: ILankaRelayEndpoint): (() => void) => {
	const { channels } = registry();
	const members = channels.get(channel) ?? new Set<ILankaRelayEndpoint>();

	for (const [eventType, holder] of newestHolders(members)) holder.handOver(endpoint, eventType);

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

/** The page's channels, as one table: joining, finding peers and the clock are one subject. */
export const lankaRelayChannels = Object.freeze({ join, peers, stamp });
