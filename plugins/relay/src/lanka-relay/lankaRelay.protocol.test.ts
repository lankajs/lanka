import { afterEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka/bootstrap";
import { setLankaScopeResolver } from "lanka/internal";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
// eslint-disable-next-line no-restricted-imports -- not another plugin: THIS plugin's own published 0.1.0, which the page protocol must keep meeting
import { lankaRelay as lankaRelay010 } from "@lankajs/plugin-relay-0.1.0";
import { lankaRelay } from "./lankaRelay";
import type { ILankaInstance, ILankaPlugin } from "lanka/bootstrap";
import type { ILankaRelayFrame } from "../_interfaces/ILankaRelayFrame";
import type { ILankaRelayTransport } from "../_interfaces/ILankaRelayTransport";

/**
 * The page protocol, held to the copies that already shipped.
 *
 * `@lankajs/plugin-relay-0.1.0` is the PUBLISHED 0.1.0, installed from the
 * registry under an alias — not a fixture written to resemble it. A page may
 * carry an application built last month beside one built today, and the two
 * meet on `globalThis[Symbol.for("lanka.relay")]` through endpoints each
 * implements: `accept`, `retained`, `handOver`, and the page's clock. Adding a
 * transport must leave every one of them as it was.
 */

const RELAY_KEY = Symbol.for("lanka.relay");

const instances: ILankaInstance[] = [];

/** One application with the relay plugin it was built with. */
const application = (plugin: ILankaPlugin): ILankaInstance => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.use(plugin);
	instances.push(lanka);
	return lanka;
};

const heardOn = (lanka: ILankaInstance, eventType: string) => {
	const heard = vi.fn();
	lanka.eventBus.subscribe(eventType, heard, { replay: "last" });
	return heard;
};

/** A transport that records what was posted, and a way to deliver a message into it. */
const medium = () => {
	const posted: ILankaRelayFrame[] = [];
	let receive: (message: unknown) => void = () => undefined;
	const transport: ILankaRelayTransport = {
		post: (message) => {
			posted.push(message as ILankaRelayFrame);
		},
		subscribe: (next) => {
			receive = next;
			return () => undefined;
		},
	};
	return { transport, posted, arrive: (message: unknown) => receive(message) };
};

afterEach(() => {
	for (const lanka of instances.splice(0)) lanka.dispose();
	setLankaScopeResolver(null);
	delete (globalThis as Record<symbol, unknown>)[RELAY_KEY];
});

describe("0.1.0 and this copy on one page", () => {
	it("hear each other in both directions, with a transport installed on this side", () => {
		const old = application(
			lankaRelay010({ channel: "shop", send: ["CART_CHANGED"], receive: ["CHECKOUT"] }),
		);
		const current = application(
			lankaRelay({
				channel: "shop",
				send: ["CHECKOUT"],
				receive: ["CART_CHANGED"],
				transport: medium().transport,
			}),
		);
		const heardByCurrent = heardOn(current, "CART_CHANGED");
		const heardByOld = heardOn(old, "CHECKOUT");

		old.eventBus.dispatch("CART_CHANGED", { count: 3 });
		current.eventBus.dispatch("CHECKOUT", { total: 12 });

		expect(heardByCurrent).toHaveBeenCalledExactlyOnceWith({ count: 3 });
		expect(heardByOld).toHaveBeenCalledExactlyOnceWith({ total: 12 });
	});

	it("hand each other what they retain at join, in both directions", async () => {
		const old = application(
			lankaRelay010({ channel: "shop", send: ["CART_CHANGED"], retain: ["CART_CHANGED"] }),
		);
		old.eventBus.dispatch("CART_CHANGED", { count: 3 });
		const current = application(
			lankaRelay({
				channel: "shop",
				send: ["CHECKOUT"],
				retain: ["CHECKOUT"],
				receive: ["CART_CHANGED"],
				transport: medium().transport,
			}),
		);
		current.eventBus.dispatch("CHECKOUT", { total: 12 });
		const late = application(lankaRelay010({ channel: "shop", receive: ["CHECKOUT"] }));

		const heardByCurrent = heardOn(current, "CART_CHANGED");
		const heardByLate = heardOn(late, "CHECKOUT");

		await vi.waitFor(() => {
			expect(heardByCurrent).toHaveBeenCalledWith({ count: 3 });
			expect(heardByLate).toHaveBeenCalledWith({ total: 12 });
		});
	});

	it("keep one clock: the newest value wins at join, whichever copy stamped it", async () => {
		const old = application(
			lankaRelay010({ channel: "shop", send: ["CART_CHANGED"], retain: ["CART_CHANGED"] }),
		);
		const current = application(
			lankaRelay({ channel: "shop", send: ["CART_CHANGED"], retain: ["CART_CHANGED"] }),
		);
		old.eventBus.dispatch("CART_CHANGED", { count: 1 });
		current.eventBus.dispatch("CART_CHANGED", { count: 2 });
		const late = application(lankaRelay010({ channel: "shop", receive: ["CART_CHANGED"] }));
		const heard = heardOn(late, "CART_CHANGED");

		await vi.waitFor(() => {
			expect(heard).toHaveBeenCalled();
		});
		expect(heard.mock.calls.map(([data]) => data)).toEqual([{ count: 2 }]);
	});

	it("do not answer another realm with a value only a 0.1.0 copy holds", () => {
		// A 0.1.0 copy has no transport, so no other realm hears its updates; a
		// relay beside it that handed its value over would hand over a value that
		// then never changes. What crosses is what the answering application
		// itself delivered.
		const old = application(
			lankaRelay010({ channel: "shop", send: ["CART_CHANGED"], retain: ["CART_CHANGED"] }),
		);
		old.eventBus.dispatch("CART_CHANGED", { count: 3 });
		const other = medium();
		application(
			lankaRelay({ channel: "shop", send: ["CART_CHANGED"], transport: other.transport }),
		);

		other.arrive({
			lanka: "relay",
			v: 1,
			kind: "hello",
			channel: "shop",
			from: "shop#worker",
			seq: 1,
		});

		expect(other.posted.filter((frame) => frame.kind === "retained")).toEqual([]);
	});
});
