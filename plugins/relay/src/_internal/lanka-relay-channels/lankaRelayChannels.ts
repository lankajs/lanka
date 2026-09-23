import { generateUuid } from "lanka/internal";
import type { ILankaRelayEndpoint } from "../../_interfaces/ILankaRelayEndpoint";

/**
 * The channels on this page, and who is on each.
 *
 * On the global object because it is the one place two copies of this package
 * — one per application bundle — can both reach, under a name each agrees on
 * without importing anything. One key for every version: the value says which
 * version wrote it, where a key per version would make two versions miss each
 * other with no error at all.
 *
 * Its shape is a protocol 0.1.0 copies already speak — they create it, join it,
 * and increment its clock — so nothing here changes what is ON it. Reading the
 * clock and moving it forward past a stamp from another realm are both things a
 * 0.1.0 copy's increments stay consistent with.
 */
interface ILankaRelayRegistry {
	readonly v: number;
	readonly channels: Map<string, Set<ILankaRelayEndpoint>>;
	/** The page's clock for retained values: higher is newer, whoever holds it. */
	clock: number;
	/**
	 * This realm's id on a transport, added on first use. 0.1.0 creates the
	 * registry without it and reads no key it does not know, so adding it is
	 * invisible to 0.1.0.
	 */
	realm?: string;
}

/** A retained value's holder, and the stamp of the value it holds. */
interface ILankaRelayHolder {
	readonly holder: ILankaRelayEndpoint;
	readonly at: number;
}

const KEY = Symbol.for("lanka.relay");

const registry = (): ILankaRelayRegistry => {
	const global = globalThis as Record<symbol, ILankaRelayRegistry | undefined>;
	return (global[KEY] ??= { v: 1, channels: new Map(), clock: 0 });
};

/** The next tick of the page's clock, for a value an endpoint is about to retain. */
const stamp = (): number => (registry().clock += 1);

/** This realm's id, the same for every copy on the page. */
const realm = (): string => (registry().realm ??= generateUuid());

/** The page's clock as it stands, without moving it. */
const now = (): number => registry().clock;

/**
 * Moves the page's clock past a stamp another realm made — the Lamport rule — so
 * a value retained here afterwards is newer than the one just heard, in every
 * realm's reckoning.
 */
const witness = (at: number): void => {
	const current = registry();
	if (at > current.clock) current.clock = at;
};

/**
 * For each retained event type, the ONE member holding the newest value.
 *
 * Several applications may retain one type — the one that announced it, and
 * any that were handed it — and a newcomer is owed the page's last fact about
 * it, once. Handing over from every holder would deliver one fact twice; from
 * an arbitrary one, possibly a stale one.
 */
const newestHolders = (members: Iterable<ILankaRelayEndpoint>): Map<string, ILankaRelayHolder> => {
	const newest = new Map<string, ILankaRelayHolder>();

	for (const member of members) {
		for (const [eventType, at] of member.retained()) {
			const current = newest.get(eventType);
			if (!current || at > current.at) newest.set(eventType, { holder: member, at });
		}
	}

	return newest;
};

/** Who is on one channel of this page, as a copy: delivery may change the set. */
const membersOf = (channel: string): ILankaRelayEndpoint[] => [
	...(registry().channels.get(channel) ?? []),
];

/** The newest holder of every retained type on one channel of this page. */
const newest = (channel: string): Map<string, ILankaRelayHolder> =>
	newestHolders(membersOf(channel));

/**
 * Puts an endpoint on a channel, after it has been handed the newest retained
 * value of every type, once each. Returns the call that takes it off again.
 */
const join = (channel: string, endpoint: ILankaRelayEndpoint): (() => void) => {
	const { channels } = registry();
	const members = channels.get(channel) ?? new Set<ILankaRelayEndpoint>();

	for (const [eventType, { holder }] of newestHolders(members)) {
		holder.handOver(endpoint, eventType);
	}

	members.add(endpoint);
	channels.set(channel, members);

	return () => {
		members.delete(endpoint);
		if (members.size === 0) channels.delete(channel);
	};
};

/** Everyone on the channel except `self`. */
const peers = (channel: string, self: ILankaRelayEndpoint): ILankaRelayEndpoint[] =>
	membersOf(channel).filter((member) => member !== self);

/**
 * Whether an endpoint is on this page's channel. A frame from one that is was
 * already delivered by the page, synchronously, and hearing it again from a
 * medium would deliver it twice.
 */
const onPage = (channel: string, id: string): boolean =>
	membersOf(channel).some((member) => member.id === id);

/**
 * The page's channels, as one table: joining, finding peers and holders, and the
 * clock are one subject — the registry every copy on the page shares.
 */
export const lankaRelayChannels = Object.freeze({
	join,
	peers,
	onPage,
	realm,
	newest,
	stamp,
	now,
	witness,
});
