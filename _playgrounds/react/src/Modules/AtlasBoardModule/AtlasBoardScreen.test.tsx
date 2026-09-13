import { AtlasBoardVM, atlasBoardMessagePosted } from "@lanka-playgrounds/_shared";
import { renderWithLanka } from "@lankajs/tool-testing";
import { screen, waitFor } from "@testing-library/dom";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtlasBoardScreen } from "./AtlasBoardScreen";
import { AtlasBoardChannel } from "../../Gateways/AtlasBoardChannel/AtlasBoardChannel";
import type { AtlasBoardGateway } from "@lanka-playgrounds/_shared";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

const fakeGateway = () =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 3, active: 1, forecast: null })),
	}) as unknown as AtlasBoardGateway;

const fakeChannel = () => {
	const sent: { type: string; payload: Record<string, unknown> }[] = [];

	return {
		sent,
		channel: {
			send: vi.fn((type: string, payload: Record<string, unknown>) => {
				sent.push({ type, payload });

				return true;
			}),
		} as unknown as ILankaWebSocketChannel,
	};
};

/**
 * The screen, with its ViewModel bound to the instance that will render it.
 *
 * The ViewModel is built inside `setup` and the element reads it through a
 * closure, because the order is load-bearing: every render gets a FRESH
 * instance, and a ViewModel registers itself with the scenario layer when it is
 * BUILT. One built before this call belongs to the instance that was just
 * replaced, and its handlers are bound to nothing — silently.
 */
const renderScreen = () => {
	const wire = fakeChannel();
	let useBoardVM: ReturnType<AtlasBoardVM["build"]> | null = null;

	const Screen = () => (
		<AtlasBoardScreen useBoardVM={useBoardVM!} channel={new AtlasBoardChannel(wire.channel)} />
	);

	renderWithLanka(<Screen />, {
		setup: () => {
			useBoardVM = new AtlasBoardVM(fakeGateway()).build();
		},
	});

	return wire;
};

afterEach(() => {
	cleanup();
});

describe("AtlasBoardScreen", () => {
	it("shows the summary the ViewModel fetched", async () => {
		renderScreen();

		await waitFor(() =>
			expect(screen.getByTestId("summary").textContent).toBe("3 queued, 1 active"),
		);
	});

	it("says what somebody typed, over the channel rather than over a gateway", async () => {
		const wire = renderScreen();

		fireEvent.change(screen.getByLabelText("Say something"), {
			target: { value: "north ridge clear" },
		});
		fireEvent.click(screen.getByText("Say"));

		expect(wire.sent).toEqual([{ type: "board.say", payload: { text: "north ridge clear" } }]);
	});

	it("sends nothing for an empty message", async () => {
		const wire = renderScreen();

		fireEvent.click(screen.getByText("Say"));

		expect(wire.sent).toEqual([]);
	});

	it("clears the box once the message has gone", async () => {
		renderScreen();
		fireEvent.change(screen.getByLabelText("Say something"), { target: { value: "hello" } });

		fireEvent.click(screen.getByText("Say"));

		await waitFor(() =>
			expect(screen.getByLabelText<HTMLInputElement>("Say something").value).toBe(""),
		);
	});

	it("shows a message somebody ELSE posted, which arrived as a fact", async () => {
		// The screen cannot tell whether this came from the socket, from a
		// server-sent event or from a button. That is the point of the layer: the
		// protocol stopped at the bridge.
		renderScreen();

		// Not awaited: `trigger` is synchronous, so this overload of `act` returns
		// nothing to await. Awaiting it would read as "the render has settled" while
		// actually awaiting `undefined` — a wait that cannot fail and therefore
		// cannot help.
		act(() => {
			atlasBoardMessagePosted.trigger({
				text: "relay mast up",
				at: "2026-09-13T00:00:00.000Z",
			});
		});

		expect(screen.getByText("relay mast up")).toBeDefined();
	});
});
