import { afterEach, describe, expect, it, vi } from "vitest";
import { resetActiveLanka } from "lanka/bootstrap";
import { startPlaygroundHeader, startPlaygroundShop } from "./app";
import type { IPlaygroundApplication } from "./app";
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

	it("hears nothing on another channel", async () => {
		const shop = track(await startPlaygroundShop(CHANNEL));
		const header = track(await startPlaygroundHeader("another-page"));

		addItem(shop);

		expect(header.viewModel.getState().count).toBe(0);
	});
});
