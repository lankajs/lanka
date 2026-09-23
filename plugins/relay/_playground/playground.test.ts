import { afterEach, describe, expect, it, vi } from "vitest";
import { resetActiveLanka } from "lanka/bootstrap";
import {
	createPlaygroundPortTransport,
	playgroundCartChanged,
	startPlaygroundHeader,
	startPlaygroundShop,
} from "./app";
import type { IPlaygroundApplication } from "./app";
import { createLankaRelayBroadcastChannelTransport } from "../src/index";
import type { ILankaRelayOptions } from "../src/index";

/**
 * The package, used as two applications on one page use it.
 *
 * `lankaRelay` is installed with the three lists an application writes —
 * `send`, `receive`, `retain` — typed as `ILankaRelayOptions`, and each screen
 * is a ViewModel resolved in a scope.
 *
 * ## Why the shop is activated before it acts
 *
 * The two applications here are two instances of ONE copy of lanka, and one
 * copy has one pointer to the active instance: a scenario an action triggers
 * goes to whichever instance that is. Separately built applications each carry
 * their own copy and their own pointer, so they never need this — which is what
 * `_playgrounds/micro-frontends` shows with two real bundles. The relay makes the
 * same switch itself when it delivers.
 */

const CHANNEL: ILankaRelayOptions["channel"] = "playground";

const started: IPlaygroundApplication<unknown>[] = [];

const track = <TApplication extends IPlaygroundApplication<unknown>>(application: TApplication) => {
	started.push(application);
	return application;
};

/** One item added to the cart, with the shop being the application that acts. */
const addItem = (shop: Awaited<ReturnType<typeof startPlaygroundShop>>) => {
	shop.lanka.activate();
	shop.viewModel.getState().addItem();
};

afterEach(() => {
	for (const application of started.splice(0)) application.lanka.dispose();
	delete (globalThis as Record<symbol, unknown>)[Symbol.for("lanka.relay")];
	resetActiveLanka();
});

describe("the relay playground", () => {
	it("shows the shop's cart count in the header", async () => {
		const shop = track(await startPlaygroundShop(CHANNEL));
		const header = track(await startPlaygroundHeader(CHANNEL));

		addItem(shop);
		addItem(shop);

		expect(header.viewModel.getState().count).toBe(2);
	});

	it("shows the current count in a header that loads after the cart changed", async () => {
		// State across applications is the last fact about it. The shop retains
		// the last change; the header joins, and its badge asks for the last value.
		const shop = track(await startPlaygroundShop(CHANNEL));
		addItem(shop);
		addItem(shop);
		addItem(shop);

		const header = track(await startPlaygroundHeader(CHANNEL));

		await vi.waitFor(() => expect(header.viewModel.getState().count).toBe(3));
	});

	it("stops updating a header whose screen was closed", async () => {
		const shop = track(await startPlaygroundShop(CHANNEL));
		const header = track(await startPlaygroundHeader(CHANNEL));
		addItem(shop);

		header.scope.dispose();
		addItem(shop);

		expect(header.viewModel.getState().count).toBe(1);
	});

	it("gives both applications a transport for other tabs, and still delivers each change here once", async () => {
		// What an application writes to be heard in other tabs, iframes and
		// workers: one more option. The page is joined either way, so the header
		// hears the shop at once — and the medium then carries the same change a
		// second time, which the header drops as already delivered.
		const shop = track(
			await startPlaygroundShop(CHANNEL, createLankaRelayBroadcastChannelTransport()),
		);
		const header = track(
			await startPlaygroundHeader(CHANNEL, createLankaRelayBroadcastChannelTransport()),
		);
		const deliveries = vi.fn();
		header.lanka.eventBus.subscribe(playgroundCartChanged.eventType, deliveries);
		const tab = createLankaRelayBroadcastChannelTransport();
		const reachedAnotherTab = vi.fn();
		const leave = tab.subscribe(reachedAnotherTab);

		addItem(shop);
		addItem(shop);

		// Another tab — played by a transport of the test's own — has had both.
		// By then the header's transport has too, and has let neither through.
		await vi.waitFor(() => {
			expect(
				reachedAnotherTab.mock.calls.filter(
					([frame]) => (frame as { kind: string }).kind === "event",
				),
			).toHaveLength(2);
		});
		leave();
		expect(header.viewModel.getState().count).toBe(2);
		expect(deliveries).toHaveBeenCalledTimes(2);
	});

	it("carries the cart through a transport the application wrote, shared by two relays", async () => {
		// A frame the application created hands back one end of a MessagePort;
		// the application implements ILankaRelayTransport over it, and gives the
		// SAME transport to the shop and to a promotion on another channel. The
		// promotion leaving must not take the shop off the port.
		const { port1, port2 } = new MessageChannel();
		const transport = createPlaygroundPortTransport(port1);
		const frame = createPlaygroundPortTransport(port2);
		const inTheFrame = vi.fn();
		frame.subscribe(inTheFrame);

		const shop = track(await startPlaygroundShop(CHANNEL, transport));
		const promotion = track(await startPlaygroundShop("promotion", transport));
		promotion.lanka.dispose();
		addItem(shop);

		try {
			await vi.waitFor(() => {
				expect(inTheFrame).toHaveBeenCalledWith(
					expect.objectContaining({
						kind: "event",
						channel: CHANNEL,
						data: { items: 1 },
					}),
				);
			});

			// And the shop still HEARS the port: the frame's application joins and
			// says hello, and the shop answers with the cart it retains.
			frame.post({
				lanka: "relay",
				v: 1,
				kind: "hello",
				channel: CHANNEL,
				from: "frame#1",
				realm: "frame",
				seq: 1,
			});
			await vi.waitFor(() => {
				expect(inTheFrame).toHaveBeenCalledWith(
					expect.objectContaining({
						kind: "retained",
						to: "frame#1",
						data: { items: 1 },
					}),
				);
			});
		} finally {
			port1.close();
			port2.close();
		}
	});

	it("hears nothing on another channel", async () => {
		const shop = track(await startPlaygroundShop(CHANNEL));
		const header = track(await startPlaygroundHeader("another-page"));

		addItem(shop);

		expect(header.viewModel.getState().count).toBe(0);
	});
});
