import {
	generateUuid,
	getLankaProcessRuntime,
	hasLankaScopeResolver,
	setActiveLankaRuntime,
} from "lanka/internal";
import { lankaLogger } from "lanka/logger";
import { joinLankaRelayMedium } from "../_internal/join-lanka-relay-medium/joinLankaRelayMedium";
import { lankaRelayChannels } from "../_internal/lanka-relay-channels/lankaRelayChannels";
import type { ILankaEventBusOutcome } from "lanka/scenario";
import type { ILankaInstance, ILankaPlugin } from "lanka/bootstrap";
import type { ILankaRelayEndpoint } from "../_interfaces/ILankaRelayEndpoint";
import type { ILankaRelayEnvelope } from "../_interfaces/ILankaRelayEnvelope";
import type { ILankaRelayState } from "../_interfaces/ILankaRelayState";
import type { ILankaRelayTransport } from "../_interfaces/ILankaRelayTransport";

/** The envelope version this copy writes and the only one it reads. */
const ENVELOPE_VERSION = 1;

/**
 * Which channel to join, and what may cross it.
 *
 * Every list is empty by default, so a relay nobody configured moves nothing.
 * Sending and receiving are separate permissions: a receiver filters inbound
 * itself rather than trusting whoever else joined the channel.
 */
export interface ILankaRelayOptions {
	/** The channel's name. Only endpoints on the same name hear each other. */
	channel: string;
	/** Event types this application's deliveries are repeated for. */
	send?: readonly string[];
	/** Event types this application accepts from the channel. */
	receive?: readonly string[];
	/**
	 * Event types, among `send`, whose LAST delivered payload is kept and handed
	 * to an application that joins later — state, as the last fact about it.
	 */
	retain?: readonly string[];
	/**
	 * A medium to the applications that are NOT on this page — other tabs,
	 * iframes, workers. Added to the page, never in its place: the page is joined
	 * either way. `createLankaRelayBroadcastChannelTransport()` is the one this package
	 * ships; payloads that cross it must be structured-cloneable.
	 */
	transport?: ILankaRelayTransport;
}

/**
 * Dispatches a received event on THIS application's bus, with this application
 * active while its handlers run.
 *
 * A handler reaches gateways and the bus through the active runtime, and two
 * instances of one copy share one pointer to it — without the switch, the
 * receiver's handlers would run against the sender's application. The previous
 * answer is restored whatever the handlers do.
 */
const deliverInto = (lanka: ILankaInstance, envelope: ILankaRelayEnvelope, channel: string) => {
	// A retained value arrives at install, before any ViewModel subscribed. Kept
	// as the event's last value, it waits for a subscriber that asks for replay —
	// the rule a local event declared `replay: "last"` already follows.
	// Only where the receiver has not decided for itself: its own replay window
	// outranks the relay's default.
	if (
		envelope.retained &&
		lanka.eventBus.getEventInfo(envelope.eventType)?.replay === undefined
	) {
		lanka.eventBus.registerEvent(envelope.eventType, { replay: "last" });
	}

	const ambient = getLankaProcessRuntime();
	lanka.activate();

	try {
		lanka.eventBus.dispatch(envelope.eventType, envelope.data, `relay:${channel}`);
	} finally {
		setActiveLankaRuntime(ambient);
	}
};

/** Hands one envelope to every peer; one peer failing does not stop the rest. */
const broadcast = (peers: ILankaRelayEndpoint[], envelope: ILankaRelayEnvelope) => {
	for (const peer of peers) {
		try {
			peer.accept(envelope);
		} catch (error) {
			lankaLogger.printScenarioLog(`Relay could not deliver "${envelope.eventType}":`, error);
		}
	}
};

const stateOf = (lanka: ILankaInstance, options: ILankaRelayOptions): ILankaRelayState => {
	const send = new Set(options.send ?? []);

	return {
		lanka,
		channel: options.channel,
		id: `${options.channel}#${generateUuid()}`,
		send,
		receive: new Set(options.receive ?? []),
		retain: new Set((options.retain ?? []).filter((eventType) => send.has(eventType))),
		retained: new Map(),
		inFlight: null,
		medium: null,
		seq: 0,
		heard: new Map(),
		known: new Map(),
	};
};

const envelopeFrom = (
	state: ILankaRelayState,
	eventType: string,
	data: unknown,
): ILankaRelayEnvelope => ({
	v: ENVELOPE_VERSION,
	from: state.id,
	eventType,
	data,
});

/** The half the OTHER applications call: taking a delivery, and handing a newcomer what it keeps. */
const endpointOf = (state: ILankaRelayState): ILankaRelayEndpoint => ({
	id: state.id,

	accept(envelope) {
		if (envelope.v !== ENVELOPE_VERSION || !state.receive.has(envelope.eventType)) return;

		// How new what this application now shows is: a handed-over value is as new
		// as the page's clock says, a live one newer than any answer can be.
		state.known.set(
			envelope.eventType,
			envelope.retained ? lankaRelayChannels.now() : Number.POSITIVE_INFINITY,
		);

		const previous = state.inFlight;
		state.inFlight = { eventType: envelope.eventType, data: envelope.data };

		try {
			deliverInto(state.lanka, envelope, state.channel);
		} finally {
			state.inFlight = previous;
		}
	},

	retained: () => new Map([...state.retained].map(([eventType, { at }]) => [eventType, at])),

	handOver(newcomer, eventType) {
		const held = state.retained.get(eventType);
		if (held) newcomer.accept({ ...envelopeFrom(state, eventType, held.data), retained: true });
	},
});

/** The half THIS application's bus calls: a delivery, repeated to every peer and every realm. */
const observerOf =
	(state: ILankaRelayState, endpoint: ILankaRelayEndpoint) =>
	(outcome: ILankaEventBusOutcome): void => {
		if (outcome.outcome !== "delivered" || !state.send.has(outcome.eventType)) return;

		// Retained BEFORE the loop guard: the last fact on the page is kept whether
		// this application announced it or was handed it, so it outlives the one
		// that did. The guard only stops it being sent back.
		const at = state.retain.has(outcome.eventType) ? lankaRelayChannels.stamp() : 0;
		if (at > 0) state.retained.set(outcome.eventType, { data: outcome.data, at });

		const { inFlight } = state;
		if (inFlight?.eventType === outcome.eventType && inFlight.data === outcome.data) return;

		broadcast(
			lankaRelayChannels.peers(state.channel, endpoint),
			envelopeFrom(state, outcome.eventType, outcome.data),
		);
		state.medium?.postEvent(outcome.eventType, outcome.data, at || lankaRelayChannels.now());
	};

const refuseOnAServer = (channel: string): void => {
	if (!hasLankaScopeResolver()) return;

	throw new Error(
		`lankaRelay("${channel}") refuses to install on a server. The global ` +
			"object there is the process, so every request on this channel would hear " +
			"every other request's users. Relay between applications on a browser page only.",
	);
};

/**
 * Joins a channel on the page and repeats the listed events to every other
 * application on it — and, given a `transport`, to the applications in other
 * tabs, iframes and workers too.
 *
 * ```ts
 * lanka.use(lankaRelay({ channel: "shop", send: ["CART_CHANGED"], retain: ["CART_CHANGED"] }));
 * ```
 *
 * For applications that CANNOT share one copy of `lanka` — different versions,
 * uncoordinated pipelines, isolation on purpose. Modules that can share one copy
 * should: one copy is one bus, and none of this is needed.
 *
 * ## It repeats deliveries, never dispatches
 *
 * An observer, not a middleware: an event is repeated only once the local chain
 * DELIVERED it, so an event an application's own middleware stopped never leaves
 * it. A middleware would forward whatever arrived before the gate did.
 *
 * ## No loops, and no lost answers
 *
 * The sender hands an event to every peer itself, and a peer never repeats what
 * it is currently being handed. Only that exact delivery is held back — an
 * answer a peer's handler dispatches while receiving is a new event, and leaves.
 *
 * ## Across realms, never forwarded
 *
 * A relay posts only what ITS application delivered, never what it was handed,
 * so an application in a worker is heard by exactly the applications that
 * installed a transport — not by one on the page that did not. Every application
 * that must hear another realm installs one.
 */
export const lankaRelay = (options: ILankaRelayOptions): ILankaPlugin => ({
	// Per channel: one instance may sit on two channels, and the plugin registry
	// refuses a second plugin of one name.
	name: `@lankajs/plugin-relay:${options.channel}`,

	install(lanka) {
		refuseOnAServer(options.channel);

		const state = stateOf(lanka, options);
		const endpoint = endpointOf(state);
		const observer = observerOf(state, endpoint);

		lanka.eventBus.addObserver(observer);
		const leave = lankaRelayChannels.join(state.channel, endpoint);
		const uninstall = () => {
			lanka.eventBus.removeObserver(observer);
			state.medium?.leave();
			leave();
			state.retained.clear();
		};

		// A consumer's transport may throw at `subscribe`. Half an install would
		// leave the observer on the bus and the endpoint on the page, with no
		// teardown returned to take them off.
		try {
			if (options.transport) {
				state.medium = joinLankaRelayMedium(state, endpoint, options.transport);
			}
		} catch (error) {
			uninstall();
			throw error;
		}

		return uninstall;
	},
});
