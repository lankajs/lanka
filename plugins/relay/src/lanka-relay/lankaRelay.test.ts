import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka/bootstrap";
import { getLankaProcessRuntime, setLankaScopeResolver } from "lanka/internal";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaRelay } from "./lankaRelay";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaRelayOptions } from "./lankaRelay";

/**
 * Two applications on one page, each with its own framework instance, hearing
 * each other through a channel.
 *
 * Two INSTANCES of one copy stand in for two copies here: each has its own bus,
 * which is the whole difference a relay has to cross. That separate COPIES
 * cross too — each with its own pointer to the running instance — is what
 * `_playgrounds/micro-frontends` shows with two real bundles.
 */

const RELAY_KEY = Symbol.for("lanka.relay");

const instances: ILankaInstance[] = [];

/** One application: an instance with a relay installed on it. */
const application = (options: ILankaRelayOptions): ILankaInstance => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.use(lankaRelay(options));
	instances.push(lanka);
	return lanka;
};

/** What one application's bus delivered for an event type. */
const heardOn = (lanka: ILankaInstance, eventType: string) => {
	const heard = vi.fn();
	lanka.eventBus.subscribe(eventType, heard);
	return heard;
};

afterEach(() => {
	for (const lanka of instances.splice(0)) lanka.dispose();
	setLankaScopeResolver(null);
	delete (globalThis as Record<symbol, unknown>)[RELAY_KEY];
});

describe("lankaRelay", () => {
	it("repeats a delivered event on every other application on the channel", () => {
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heard).toHaveBeenCalledOnce();
		expect(heard).toHaveBeenCalledWith({ count: 3 });
	});

	it("sends nothing that is not on the sender's list", () => {
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		const header = application({ channel: "shop", receive: ["CART_CHANGED", "SECRET"] });
		const heard = heardOn(header, "SECRET");

		shell.eventBus.dispatch("SECRET", { token: "t" });

		expect(heard).not.toHaveBeenCalled();
	});

	it("receives nothing that is not on the receiver's list", () => {
		// The receiver filters inbound itself rather than trusting whoever else
		// joined the channel: sending and receiving are separate permissions.
		const shell = application({ channel: "shop", send: ["CART_CHANGED", "SECRET"] });
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "SECRET");

		shell.eventBus.dispatch("SECRET", { token: "t" });

		expect(heard).not.toHaveBeenCalled();
	});

	it("never repeats an event the sender's own middleware stopped", () => {
		// A gate the relay routes around is not a gate: an authorisation check or a
		// privacy filter stops an event on THIS page, and it must stop it everywhere.
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		shell.eventBus.addMiddleware(() => ({ stop: "not signed in" }));
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heard).not.toHaveBeenCalled();
	});

	it("does not send an event back to where it came from", () => {
		const both = { channel: "shop", send: ["CART_CHANGED"], receive: ["CART_CHANGED"] };
		const shell = application(both);
		const header = application(both);
		const heardByShell = heardOn(shell, "CART_CHANGED");
		const heardByHeader = heardOn(header, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heardByShell).toHaveBeenCalledOnce();
		expect(heardByHeader).toHaveBeenCalledOnce();
	});

	it("reaches every application on the channel exactly once", () => {
		const both = { channel: "shop", send: ["CART_CHANGED"], receive: ["CART_CHANGED"] };
		const shell = application(both);
		const header = application(both);
		const footer = application(both);
		const heardByHeader = heardOn(header, "CART_CHANGED");
		const heardByFooter = heardOn(footer, "CART_CHANGED");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heardByHeader).toHaveBeenCalledOnce();
		expect(heardByFooter).toHaveBeenCalledOnce();
	});

	it("carries an answer to a relayed event on to everyone else", () => {
		// The second hop. The header answers CART_CHANGED with BADGE_SHOWN while
		// CART_CHANGED is still being delivered to it; only the exact delivery in
		// flight is held back, so the answer leaves.
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			receive: ["BADGE_SHOWN"],
		});
		const header = application({
			channel: "shop",
			send: ["BADGE_SHOWN"],
			receive: ["CART_CHANGED"],
		});
		const footer = application({ channel: "shop", receive: ["BADGE_SHOWN"] });
		header.eventBus.subscribe("CART_CHANGED", () => {
			header.eventBus.dispatch("BADGE_SHOWN", { count: 3 });
		});
		const heardByShell = heardOn(shell, "BADGE_SHOWN");
		const heardByFooter = heardOn(footer, "BADGE_SHOWN");

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heardByShell).toHaveBeenCalledWith({ count: 3 });
		expect(heardByFooter).toHaveBeenCalledWith({ count: 3 });
	});

	it("keeps two channels apart", () => {
		const shop = application({ channel: "shop", send: ["CART_CHANGED"] });
		const admin = application({ channel: "admin", receive: ["CART_CHANGED"] });
		const heard = heardOn(admin, "CART_CHANGED");

		shop.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heard).not.toHaveBeenCalled();
	});

	it("leaves the channel when the application goes", () => {
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");

		header.dispose();
		header.eventBus.subscribe("CART_CHANGED", heard);
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(heard).not.toHaveBeenCalled();
	});

	it("hands an application that arrives later the last value of what it retains", () => {
		// State across copies is the last fact about it. An application loaded
		// after the cart changed still has to show the count.
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			retain: ["CART_CHANGED"],
		});
		shell.eventBus.dispatch("CART_CHANGED", { count: 2 });
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		const header = createLanka({ host: lankaTestHost });
		instances.push(header);
		const heard = heardOn(header, "CART_CHANGED");
		header.use(lankaRelay({ channel: "shop", receive: ["CART_CHANGED"] }));

		expect(heard).toHaveBeenCalledOnce();
		expect(heard).toHaveBeenCalledWith({ count: 3 });
	});

	it("keeps a retained value for a subscriber that arrives after the application joined", () => {
		// The order an application starts in: plugins install BEFORE bootstrap, so
		// the retained value arrives before any ViewModel has subscribed. It waits
		// on the receiving bus as the last value, the way a local event declared
		// `replay: "last"` does, for a subscriber that asks for it.
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			retain: ["CART_CHANGED"],
		});
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = vi.fn();
		header.eventBus.subscribe("CART_CHANGED", heard, { replay: "last" });

		return vi.waitFor(() => expect(heard).toHaveBeenCalledWith({ count: 3 }));
	});

	it("leaves a replay window the receiver configured itself alone", () => {
		// The receiver's own decision about how much of an event to keep outranks
		// the relay's default of "the last one".
		const shell = application({
			channel: "shop",
			send: ["CART_CHANGED"],
			retain: ["CART_CHANGED"],
		});
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		const header = createLanka({ host: lankaTestHost });
		instances.push(header);
		header.eventBus.registerEvent("CART_CHANGED", { replay: 5 });
		header.use(lankaRelay({ channel: "shop", receive: ["CART_CHANGED"] }));

		expect(header.eventBus.getEventInfo("CART_CHANGED")?.replay).toBe(5);
	});

	it("retains nothing it was not told to", () => {
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		const header = createLanka({ host: lankaTestHost });
		instances.push(header);
		const heard = heardOn(header, "CART_CHANGED");
		header.use(lankaRelay({ channel: "shop", receive: ["CART_CHANGED"] }));

		expect(heard).not.toHaveBeenCalled();
	});

	it("runs the receiver's handlers against the receiver's own runtime", () => {
		// A handler reaches gateways and the bus through the active runtime. It
		// must find its OWN application there, not the one that sent the event.
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		let seenBy: unknown = null;
		header.eventBus.subscribe("CART_CHANGED", () => {
			seenBy = getLankaProcessRuntime();
		});
		shell.activate();

		shell.eventBus.dispatch("CART_CHANGED", { count: 3 });

		expect(seenBy).toBe(header);
		// …and the sender is active again afterwards.
		expect(getLankaProcessRuntime()).toBe(shell);
	});

	it("ignores an envelope in a version it does not know", () => {
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");
		const registry = (globalThis as Record<symbol, unknown>)[RELAY_KEY] as {
			channels: Map<string, Set<{ accept: (envelope: unknown) => void }>>;
		};

		for (const endpoint of registry.channels.get("shop") ?? []) {
			endpoint.accept({ v: 2, from: "future", eventType: "CART_CHANGED", data: {} });
		}

		expect(heard).not.toHaveBeenCalled();
	});

	it("still reaches the others when one application fails to take a delivery", () => {
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		const registry = (globalThis as Record<symbol, unknown>)[RELAY_KEY] as {
			channels: Map<string, Set<unknown>>;
		};
		registry.channels.get("shop")?.add({
			id: "broken",
			accept: () => {
				throw new Error("cannot take it");
			},
			greet: () => undefined,
		});
		const header = application({ channel: "shop", receive: ["CART_CHANGED"] });
		const heard = heardOn(header, "CART_CHANGED");

		expect(() => shell.eventBus.dispatch("CART_CHANGED", { count: 3 })).not.toThrow();
		expect(heard).toHaveBeenCalledOnce();
	});

	it("sends to nobody, without failing, once the page's channels are gone", () => {
		const shell = application({ channel: "shop", send: ["CART_CHANGED"] });
		delete (globalThis as Record<symbol, unknown>)[RELAY_KEY];

		expect(() => shell.eventBus.dispatch("CART_CHANGED", { count: 3 })).not.toThrow();
	});

	it("refuses to install on a server", () => {
		// On a server the global object is the process: every request on a channel
		// would hear every other request's users.
		setLankaScopeResolver(() => ({}));
		const lanka = createLanka({ host: lankaTestHost });
		instances.push(lanka);

		expect(() => lanka.use(lankaRelay({ channel: "shop" }))).toThrowError(/server/i);
	});

	it("is one endpoint per channel on an instance", () => {
		const lanka = application({ channel: "shop" });

		expect(() => lanka.use(lankaRelay({ channel: "shop" }))).toThrow();
		expect(() => lanka.use(lankaRelay({ channel: "admin" }))).not.toThrow();
	});
});
