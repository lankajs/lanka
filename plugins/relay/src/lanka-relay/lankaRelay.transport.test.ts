import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka/bootstrap";
import { lankaLogger } from "lanka/logger";
import { setLankaScopeResolver } from "lanka/internal";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaRelay } from "./lankaRelay";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaRelayEndpoint } from "../_interfaces/ILankaRelayEndpoint";
import type { ILankaRelayFrame } from "../_interfaces/ILankaRelayFrame";
import type { ILankaRelayTransport } from "../_interfaces/ILankaRelayTransport";
import type { ILankaRelayOptions } from "./lankaRelay";

/**
 * A relay with a transport: the page as before, and frames to and from the
 * realms that are not on it.
 *
 * The other realm is played by the test. It holds both ends of a transport —
 * what the relay posted, and a way to hand the relay a message — and writes
 * frames as another realm's relay would, with an id no endpoint on this page
 * has. That a real second realm behaves the same is `lankaRelay.realms.test.ts`,
 * with a worker thread and `BroadcastChannel`.
 */

const RELAY_KEY = Symbol.for("lanka.relay");

const instances: ILankaInstance[] = [];

/** A transport the test holds both ends of. */
const medium = () => {
	const posted: ILankaRelayFrame[] = [];
	const receivers = new Set<(message: unknown) => void>();
	const transport: ILankaRelayTransport = {
		post: (message) => {
			posted.push(message as ILankaRelayFrame);
		},
		subscribe: (receive) => {
			receivers.add(receive);
			return () => receivers.delete(receive);
		},
	};

	return {
		transport,
		posted,
		/** What the relay posted of one kind. */
		postedOf: (kind: ILankaRelayFrame["kind"]) => posted.filter((frame) => frame.kind === kind),
		/** A message arriving from the medium. */
		arrive: (message: unknown) => {
			for (const receive of [...receivers]) receive(message);
		},
		listening: () => receivers.size,
	};
};

/** A frame as another realm's relay writes it. */
const frame = (over: Partial<ILankaRelayFrame> = {}): ILankaRelayFrame => ({
	lanka: "relay",
	v: 1,
	kind: "event",
	channel: "shop",
	from: "shop#worker",
	seq: 1,
	...over,
});

const application = (options: ILankaRelayOptions): ILankaInstance => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.use(lankaRelay(options));
	instances.push(lanka);
	return lanka;
};

const heardOn = (lanka: ILankaInstance, eventType: string) => {
	const heard = vi.fn();
	lanka.eventBus.subscribe(eventType, heard);
	return heard;
};

/** The endpoint ids on this page's channel, read off the registry every copy shares. */
const idsOnPage = (channel: string): string[] => {
	const registry = (
		globalThis as Record<symbol, { channels: Map<string, Set<ILankaRelayEndpoint>> }>
	)[RELAY_KEY];
	return [...(registry.channels.get(channel) ?? [])].map((endpoint) => endpoint.id);
};

afterEach(() => {
	for (const lanka of instances.splice(0)) lanka.dispose();
	setLankaScopeResolver(null);
	vi.restoreAllMocks();
	delete (globalThis as Record<symbol, unknown>)[RELAY_KEY];
});

describe("a relay with a transport", () => {
	it("says hello as it joins, and posts every delivery on its send list as a numbered frame", () => {
		const other = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			transport: other.transport,
		});

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		const [id] = idsOnPage("shop");
		expect(other.posted).toEqual([
			{
				lanka: "relay",
				v: 1,
				channel: "shop",
				from: id,
				realm: expect.any(String),
				seq: 1,
				kind: "hello",
			},
			expect.objectContaining({
				kind: "event",
				from: id,
				seq: 2,
				eventType: "CART_CHANGED",
				data: { count: 3 },
				at: expect.any(Number),
			}),
		]);
	});

	it("still reaches its own page: the transport is added to the page, not put in its place", () => {
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			transport: medium().transport,
		});
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heard).toHaveBeenCalledExactlyOnceWith({ count: 3 });
	});

	it("posts nothing that is not on its send list", () => {
		const other = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			transport: other.transport,
		});

		shell.eventBus.dispatch("SECRET", { token: "t" });

		expect(other.postedOf("event")).toEqual([]);
	});

	it("delivers an event from another realm once, however often the medium repeats it", () => {
		// A frame numbered at or below the last one from its sender is a copy — a
		// medium that delivered twice, or two media carrying one post.
		const other = medium();
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(header, "CART_CHANGED");

		other.arrive(frame({ eventType: "CART_CHANGED", data: { count: 1 }, seq: 1 }));
		other.arrive(frame({ eventType: "CART_CHANGED", data: { count: 1 }, seq: 1 }));
		other.arrive(frame({ eventType: "CART_CHANGED", data: { count: 2 }, seq: 2 }));

		expect(heard.mock.calls.map(([data]) => data)).toEqual([{ count: 1 }, { count: 2 }]);
	});

	it("drops a frame from an application on its own page, which the page already delivered", () => {
		// Two applications on one page, each with a transport of its own over one
		// medium: the page delivers synchronously, and the medium then carries the
		// same post again. Heard twice would be every event twice.
		const shellMedium = medium();
		const headerMedium = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			transport: shellMedium.transport,
		});
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: headerMedium.transport,
		});
		const heard = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });
		for (const posted of shellMedium.postedOf("event")) headerMedium.arrive(posted);

		expect(heard).toHaveBeenCalledOnce();
	});

	it("drops a frame from its own page though the sender left before the medium delivered it", () => {
		// The medium is asynchronous; an application may unmount in the same task
		// it dispatched in. Its frame, arriving afterwards, is still from this
		// realm — which the page already delivered to — whoever is on it now.
		const shellMedium = medium();
		const headerMedium = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			transport: shellMedium.transport,
		});
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: headerMedium.transport,
		});
		const heard = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });
		shell.dispose();
		for (const posted of shellMedium.postedOf("event")) headerMedium.arrive(posted);

		expect(heard).toHaveBeenCalledOnce();
	});

	it("drops a frame without a realm from an endpoint on its page", () => {
		// A frame another writer made without the realm mark is judged by who is on
		// the page — the rule the realm replaced, kept for frames that lack it.
		const other = medium();
		application({ channel: "shop", send: ["CART_CHANGED"] });
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(header, "CART_CHANGED");

		other.arrive(frame({ eventType: "CART_CHANGED", from: idsOnPage("shop")[0] }));

		expect(heard).not.toHaveBeenCalled();
	});

	it("drops its own frame, handed back by a medium that echoes", () => {
		const other = medium();
		const both = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(both, "CART_CHANGED");

		both.eventBus.dispatch("CART_CHANGED", { count: 3 });
		for (const posted of other.postedOf("event")) other.arrive(posted);

		expect(heard).toHaveBeenCalledOnce();
	});

	it("ignores what is not its protocol: another library's traffic, another version, another channel", () => {
		const other = medium();
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(header, "CART_CHANGED");

		for (const message of [
			null,
			"CART_CHANGED",
			{ type: "CART_CHANGED" },
			frame({ eventType: "CART_CHANGED", lanka: "other" as "relay" }),
			frame({ eventType: "CART_CHANGED", v: 2 }),
			frame({ eventType: "CART_CHANGED", channel: "elsewhere" }),
			frame({ eventType: "CART_CHANGED", from: 7 as unknown as string }),
			frame({ eventType: "CART_CHANGED", seq: "1" as unknown as number }),
			frame({ eventType: 7 as unknown as string, seq: 5 }),
			frame({ eventType: "CART_CHANGED", kind: "goodbye" as "event", seq: 6 }),
			// A key every object inherits: a table read without `hasOwn` would call
			// `Object.prototype` as a handler, and throw inside the transport.
			frame({ eventType: "CART_CHANGED", kind: "__proto__" as "event", seq: 7 }),
		]) {
			other.arrive(message);
		}

		expect(heard).not.toHaveBeenCalled();
	});

	it("receives nothing from another realm that is not on its receive list", () => {
		const other = medium();
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(header, "SECRET");

		other.arrive(frame({ eventType: "SECRET", data: { token: "t" } }));

		expect(heard).not.toHaveBeenCalled();
	});

	it("never forwards: an event from another realm is neither posted again nor repeated to its page", () => {
		// A relay posts what ITS application delivered, never what it was handed.
		// An application on the page without a transport does not hear another
		// realm — every application that must, installs one.
		const other = medium();
		const bridge = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const pageOnly = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heardByBridge = heardOn(bridge, "CART_CHANGED");
		const heardByPageOnly = heardOn(pageOnly, "CART_CHANGED");

		other.arrive(frame({ eventType: "CART_CHANGED", data: { count: 1 } }));

		expect(heardByBridge).toHaveBeenCalledOnce();
		expect(heardByPageOnly).not.toHaveBeenCalled();
		expect(other.postedOf("event")).toEqual([]);
	});

	it("moves the page's clock past every stamp it hears, so what it retains next is newer", () => {
		const other = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			receive: ["PRICE_CHANGED"],
			retain: ["CART_CHANGED"],
			transport: other.transport,
		});

		other.arrive(frame({ eventType: "PRICE_CHANGED", at: 100 }));
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(other.postedOf("event")[0].at).toBe(101);
	});

	it("refuses a frame whose stamp or number is not a safe count, and keeps the page's clock a number", () => {
		// The clock is on the global object every copy on the page shares — 0.1.0
		// copies with no transport included. One frame with `at: "99"` would make it
		// a string for the life of the page; `at: Infinity` would freeze it, and
		// every newcomer would be handed the first value instead of the newest.
		const other = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			receive: ["PRICE_CHANGED"],
			retain: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(shell, "PRICE_CHANGED");

		const bad: Partial<ILankaRelayFrame>[] = [
			{ at: "99" as unknown as number },
			{ at: Number.POSITIVE_INFINITY },
			{ at: 2 ** 60 },
			{ at: -1 },
			{ at: 1.5 },
			{ seq: Number.NaN },
			{ seq: 0 },
			{ seq: Number.POSITIVE_INFINITY },
			{ realm: 7 as unknown as string },
		];
		for (const [index, over] of bad.entries()) {
			other.arrive(
				frame({ eventType: "PRICE_CHANGED", from: `shop#bad-${String(index)}`, ...over }),
			);
		}
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heard).not.toHaveBeenCalled();
		expect(other.postedOf("event")[0].at).toBe(1);
	});

	it("undoes its install when the transport refuses to be subscribed to", () => {
		// A consumer's transport may throw at `subscribe` — a port already closed.
		// Half an install would leave the observer on the bus and the endpoint on
		// the page with nothing to take them off again.
		const refusing: ILankaRelayTransport = {
			post: () => undefined,
			subscribe: () => {
				throw new Error("the port is closed");
			},
		};
		const lanka = createLanka({ host: lankaTestHost });
		instances.push(lanka);

		expect(() =>
			lanka.use(lankaRelay({ channel: "shop", send: ["CART_CHANGED"], transport: refusing })),
		).toThrowError(/the port is closed/);
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");
		lanka.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(idsOnPage("shop")).toHaveLength(1);
		expect(heard).not.toHaveBeenCalled();
	});

	it("keeps delivering when the transport refuses a payload, and says which event did not cross", () => {
		// A function is not structured-cloneable: `postMessage` throws inside the
		// bus's observer. The page and the application itself must not pay for it.
		const logged = vi
			.spyOn(lankaLogger, "printScenarioLog")
			.mockImplementation(() => undefined);
		const refusing: ILankaRelayTransport = {
			post: () => {
				throw new DOMException("could not be cloned", "DataCloneError");
			},
			subscribe: () => () => undefined,
		};
		const shell = application({ channel: "shop", send: ["CART_CHANGED"], transport: refusing });
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heardHere = heardOn(shell, "CART_CHANGED");
		const heardOnPage = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { onClick: () => undefined });

		expect(heardHere).toHaveBeenCalledOnce();
		expect(heardOnPage).toHaveBeenCalledOnce();
		expect(logged).toHaveBeenCalledWith(
			expect.stringContaining('"CART_CHANGED"'),
			expect.any(DOMException),
		);
	});

	it("stops hearing the medium when its application is disposed", () => {
		const other = medium();
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const heard = heardOn(header, "CART_CHANGED");

		header.dispose();
		other.arrive(frame({ eventType: "CART_CHANGED" }));

		expect(other.listening()).toBe(0);
		expect(heard).not.toHaveBeenCalled();
	});
});

describe("what a relay with a transport hands another realm that joins", () => {
	it("answers a hello with what its own application retains, never another application's value", () => {
		// A relay posts only what ITS application delivered. The header holds a
		// newer value and has no transport: a realm that cannot hear its updates
		// is not handed one of its values either — shown once and never updated,
		// it would go stale where nothing could tell.
		const other = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			retain: ["CART_CHANGED"],
			transport: other.transport,
		});
		const header = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			retain: ["CART_CHANGED"],
		});

		shell.eventBus.dispatch("CART_CHANGED", { count: 1 });
		header.eventBus.dispatch("CART_CHANGED", { count: 2 });
		other.arrive(frame({ kind: "hello", from: "shop#newcomer" }));

		expect(other.postedOf("retained")).toEqual([
			expect.objectContaining({
				to: "shop#newcomer",
				eventType: "CART_CHANGED",
				data: { count: 1 },
				at: 1,
			}),
		]);
	});

	it("answers nothing its application did not retain", () => {
		const other = medium();
		application({ channel: "shop", send: ["CART_CHANGED"], transport: other.transport });
		const header = application({ channel: "shop", send: ["SECRET"], retain: ["SECRET"] });

		header.eventBus.dispatch("SECRET", { token: "t" });
		other.arrive(frame({ kind: "hello", from: "shop#newcomer" }));

		expect(other.postedOf("retained")).toEqual([]);
	});

	it("does not answer a hello from its own page, which the page's join already served", () => {
		const shellMedium = medium();
		const headerMedium = medium();
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			retain: ["CART_CHANGED"],
			transport: shellMedium.transport,
		});
		shell.eventBus.dispatch("CART_CHANGED", { count: 1 });
		application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: headerMedium.transport,
		});

		for (const hello of headerMedium.postedOf("hello")) shellMedium.arrive(hello);

		expect(shellMedium.postedOf("retained")).toEqual([]);
	});
});

describe("what a relay with a transport takes from the realms that answer", () => {
	const answer = (over: Partial<ILankaRelayFrame>) =>
		frame({ kind: "retained", eventType: "CART_CHANGED", ...over });

	/** A newcomer, and the id another realm would address its answer to. */
	const newcomer = (other: ReturnType<typeof medium>) => {
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const [id] = idsOnPage("shop");
		return { header, id };
	};

	it("takes an answer addressed to it as the event's last value, for a subscriber that comes later", async () => {
		const other = medium();
		const { header, id } = newcomer(other);

		other.arrive(answer({ to: id, data: { count: 4 }, at: 5 }));

		const later = vi.fn();
		header.eventBus.subscribe("CART_CHANGED", later, { replay: "last" });
		await vi.waitFor(() => {
			expect(later).toHaveBeenCalledWith({ count: 4 });
		});
	});

	it("drops an answer addressed to another endpoint", () => {
		const other = medium();
		const { header } = newcomer(other);
		const heard = heardOn(header, "CART_CHANGED");

		other.arrive(answer({ to: "shop#someone-else", data: { count: 4 }, at: 5 }));

		expect(heard).not.toHaveBeenCalled();
	});

	it("never moves backwards: an answer no newer than what it shows is dropped", () => {
		// Realms answer in whatever order the medium delivers. Taking every answer
		// would make a screen flip to whichever arrived last.
		const other = medium();
		const { header, id } = newcomer(other);
		const heard = heardOn(header, "CART_CHANGED");

		other.arrive(answer({ to: id, data: { count: 5 }, at: 5, from: "shop#a" }));
		other.arrive(answer({ to: id, data: { count: 5 }, at: 5, from: "shop#b" }));
		other.arrive(answer({ to: id, data: { count: 3 }, at: 3, from: "shop#c" }));
		other.arrive(answer({ to: id, data: { count: 9 }, at: 9, from: "shop#d" }));
		other.arrive(answer({ to: id, data: { count: 0 }, from: "shop#e" }));

		expect(heard.mock.calls.map(([data]) => data)).toEqual([{ count: 5 }, { count: 9 }]);
	});

	it("drops every answer once a live event has arrived: what happened outranks what was kept", () => {
		const other = medium();
		const { header, id } = newcomer(other);
		const heard = heardOn(header, "CART_CHANGED");

		other.arrive(
			frame({ eventType: "CART_CHANGED", data: { count: 1 }, from: "shop#live", at: 2 }),
		);
		other.arrive(answer({ to: id, data: { count: 100 }, at: 100, from: "shop#late" }));

		expect(heard.mock.calls.map(([data]) => data)).toEqual([{ count: 1 }]);
	});

	it("weighs what the page handed it at join by the stamp its holder gave it", () => {
		// The page's value arrives synchronously at join; an answer from another
		// realm arrives later. Older than the page's, it is dropped; newer, taken.
		// The page's clock has moved on since the value was stamped — a second type
		// was retained after it — so "as new as the clock" would refuse an answer
		// that is newer than the VALUE.
		const holder = application({
			channel: "shop",
			send: ["CART_CHANGED", "PRICE_CHANGED"],
			retain: ["CART_CHANGED", "PRICE_CHANGED"],
		});
		holder.eventBus.dispatch("CART_CHANGED", { count: 1 });
		holder.eventBus.dispatch("PRICE_CHANGED", { price: 5 });
		const other = medium();
		const header = application({
			channel: "shop",
			receive: ["CART_CHANGED"],
			transport: other.transport,
		});
		const id = idsOnPage("shop")[1];
		const heard = heardOn(header, "CART_CHANGED");

		other.arrive(answer({ to: id, data: { count: 0 }, at: 1, from: "shop#older" }));
		other.arrive(answer({ to: id, data: { count: 7 }, at: 2, from: "shop#newer" }));

		expect(heard.mock.calls.map(([data]) => data)).toEqual([{ count: 7 }]);
	});

	it("takes nothing from an answer for a type it does not receive", () => {
		const other = medium();
		const { header, id } = newcomer(other);
		const heard = heardOn(header, "SECRET");

		other.arrive(answer({ to: id, eventType: "SECRET", data: { token: "t" }, at: 5 }));

		expect(heard).not.toHaveBeenCalled();
	});
});
