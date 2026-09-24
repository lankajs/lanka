import { lankaLogger } from "lanka/logger";
import { lankaRelayChannels } from "../lanka-relay-channels/lankaRelayChannels";
import type { ILankaRelayEndpoint } from "../../_interfaces/ILankaRelayEndpoint";
import type { ILankaRelayFrame } from "../../_interfaces/ILankaRelayFrame";
import type { ILankaRelayMediumLink, ILankaRelayState } from "../../_interfaces/ILankaRelayState";
import type { ILankaRelayTransport } from "../../_interfaces/ILankaRelayTransport";

/** The frame version this copy writes and the only one it reads. */
const FRAME_VERSION = 1;

/** The page's envelope version, which a frame is turned into for `accept`. */
const ENVELOPE_VERSION = 1;

/** A frame's own fields: what a sender chooses, as against what every frame carries. */
type TLankaRelayFrameBody = Pick<ILankaRelayFrame, "kind" | "at" | "to" | "eventType" | "data">;

/**
 * Hands one frame to the transport, numbered.
 *
 * A post can throw — a payload that is not structured-cloneable, a medium that
 * closed — and it runs inside the bus's observer, so it is caught here the way a
 * peer's failure is caught on the page: the local delivery already happened, and
 * the realms that missed it are named in the log.
 */
const post = (
	state: ILankaRelayState,
	transport: ILankaRelayTransport,
	body: TLankaRelayFrameBody,
): void => {
	state.seq += 1;
	const frame: ILankaRelayFrame = {
		lanka: "relay",
		v: FRAME_VERSION,
		channel: state.channel,
		from: state.id,
		realm: lankaRelayChannels.realm(),
		seq: state.seq,
		...body,
	};

	try {
		transport.post(frame);
	} catch (error) {
		lankaLogger.printScenarioLog(
			`Relay could not post "${body.eventType ?? body.kind}" to its transport:`,
			error,
		);
	}
};

/** A count a frame may carry: a whole number no clock or counter can be broken by. */
const isCount = (value: unknown, least: number): boolean =>
	Number.isSafeInteger(value) && (value as number) >= least;

/**
 * Whether a message is a frame of THIS protocol, on this channel, with fields
 * that are safe to act on. Anything else on the medium is someone else's.
 *
 * A transport is an untrusted medium, and `at` is written into the clock every
 * copy on the page shares — 0.1.0 copies with no transport included. A string
 * there would make the clock a string for the life of the page; `Infinity` would
 * freeze it, and every newcomer would be handed the first value, not the newest.
 */
const isFrame = (message: unknown, channel: string): message is ILankaRelayFrame => {
	if (typeof message !== "object" || message === null) return false;
	const frame = message as Partial<ILankaRelayFrame>;

	return (
		frame.lanka === "relay" &&
		frame.v === FRAME_VERSION &&
		frame.channel === channel &&
		typeof frame.kind === "string" &&
		Object.hasOwn(ON_FRAME, frame.kind) &&
		typeof frame.from === "string" &&
		isCount(frame.seq, 1) &&
		(frame.at === undefined || isCount(frame.at, 0)) &&
		(frame.realm === undefined || typeof frame.realm === "string")
	);
};

/**
 * Whether a frame comes from this realm, which the page delivered already.
 *
 * By the realm's id, which outlives its sender: an application that dispatched
 * and left the page in one task still posted from here. Membership of the page
 * is the rule for a frame that carries no realm.
 */
const isFromThisRealm = (state: ILankaRelayState, frame: ILankaRelayFrame): boolean =>
	frame.realm === undefined
		? lankaRelayChannels.onPage(state.channel, frame.from)
		: frame.realm === lankaRelayChannels.realm();

/**
 * Whether a frame is news: from another realm, and after everything already
 * heard from its sender. A frame numbered at or below the last one from its
 * sender is a copy.
 */
const isNews = (state: ILankaRelayState, frame: ILankaRelayFrame): boolean => {
	if (frame.from === state.id || isFromThisRealm(state, frame)) return false;
	if (frame.seq <= (state.heard.get(frame.from) ?? 0)) return false;

	state.heard.set(frame.from, frame.seq);
	return true;
};

/**
 * Answers another realm's `hello` with what THIS application retains, each
 * value stamped as it was stamped here.
 *
 * Only this application's, because a relay posts only what its application
 * delivered: a value another application on the page holds — one with no
 * transport, a 0.1.0 copy — would reach the other realm once and never be
 * updated there, since that application's later deliveries do not cross.
 */
const answer = (
	state: ILankaRelayState,
	transport: ILankaRelayTransport,
	hello: ILankaRelayFrame,
): void => {
	for (const [eventType, { data, at }] of state.retained) {
		post(state, transport, { kind: "retained", to: hello.from, eventType, data, at });
	}
};

/**
 * Takes one frame's value into this application: a live `event` always, a
 * `retained` answer only if it carries a stamp strictly newer than what is
 * shown — an unstamped answer cannot be weighed, so it is not taken.
 */
const take = (state: ILankaRelayState, endpoint: ILankaRelayEndpoint, frame: ILankaRelayFrame) => {
	if (typeof frame.eventType !== "string") return;

	const retained = frame.kind === "retained";
	const at = frame.at ?? Number.NaN;
	if (retained && !(at > (state.known.get(frame.eventType) ?? -Infinity))) return;

	endpoint.accept({
		v: ENVELOPE_VERSION,
		from: frame.from,
		eventType: frame.eventType,
		data: frame.data,
		...(retained ? { retained: true as const } : {}),
	});

	// After `accept`, which recorded it as page-stamped: an answer is as new as
	// the stamp it came with, and no newer.
	if (retained && state.receive.has(frame.eventType)) {
		state.known.set(frame.eventType, at);
	}
};

/** What a frame handler is handed: the endpoint's three halves. */
interface ILankaRelayMediumContext {
	readonly state: ILankaRelayState;
	readonly endpoint: ILankaRelayEndpoint;
	readonly transport: ILankaRelayTransport;
}

/**
 * What each kind of frame makes this endpoint do — one row per kind, and the
 * list `isFrame` accepts: a kind with no row is someone else's frame.
 */
const ON_FRAME: Readonly<
	Record<
		ILankaRelayFrame["kind"],
		(context: ILankaRelayMediumContext, frame: ILankaRelayFrame) => void
	>
> = Object.freeze({
	hello: ({ state, transport }, frame) => {
		answer(state, transport, frame);
	},
	event: ({ state, endpoint }, frame) => {
		take(state, endpoint, frame);
	},
	// An answer is for the endpoint that asked; every other one drops it.
	retained: ({ state, endpoint }, frame) => {
		if (frame.to === state.id) take(state, endpoint, frame);
	},
});

/** The transport's receiver: every message on the medium, sorted into what this endpoint acts on. */
const hear =
	(context: ILankaRelayMediumContext) =>
	(message: unknown): void => {
		if (!isFrame(message, context.state.channel) || !isNews(context.state, message)) return;

		lankaRelayChannels.witness(message.at ?? 0);
		ON_FRAME[message.kind](context, message);
	};

/**
 * Puts an endpoint on a transport, as well as on its page, and asks the other
 * realms what they retain.
 *
 * What the page handed over at join is recorded at the stamp its holder gave it
 * — not as "now" — so an answer from another realm that is genuinely newer still
 * replaces it, and one that is older does not.
 */
export const joinLankaRelayMedium = (
	state: ILankaRelayState,
	endpoint: ILankaRelayEndpoint,
	transport: ILankaRelayTransport,
): ILankaRelayMediumLink => {
	for (const [eventType, { at }] of lankaRelayChannels.newest(state.channel)) {
		if (state.known.has(eventType)) state.known.set(eventType, at);
	}

	const stop = transport.subscribe(hear({ state, endpoint, transport }));
	post(state, transport, { kind: "hello" });

	return {
		postEvent: (eventType, data, at) => {
			post(state, transport, { kind: "event", eventType, data, at });
		},
		leave: () => {
			stop();
			state.heard.clear();
		},
	};
};
