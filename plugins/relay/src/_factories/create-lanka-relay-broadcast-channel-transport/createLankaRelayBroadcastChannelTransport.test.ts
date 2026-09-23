// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { lankaLogger } from "lanka/logger";
import { createLankaRelayBroadcastChannelTransport } from "./createLankaRelayBroadcastChannelTransport";

/**
 * The shipped transport, over the real `BroadcastChannel` Node provides — the
 * same one a browser does, delivering asynchronously between separate channel
 * objects of one name.
 */

const unsubscribes: (() => void)[] = [];

/** Subscribes, and remembers to leave, so no channel keeps the process alive. */
const listen = (
	transport: ReturnType<typeof createLankaRelayBroadcastChannelTransport>,
	receive: (message: unknown) => void,
) => {
	unsubscribes.push(transport.subscribe(receive));
};

afterEach(() => {
	for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("createLankaRelayBroadcastChannelTransport", () => {
	it("carries a post to another transport on the medium, as a copy", async () => {
		const sender = createLankaRelayBroadcastChannelTransport();
		const receiver = createLankaRelayBroadcastChannelTransport();
		const heard = vi.fn();
		listen(receiver, heard);
		listen(sender, () => undefined);
		const message = { lanka: "relay", payload: { count: 3 } };

		sender.post(message);

		await vi.waitFor(() => {
			expect(heard).toHaveBeenCalledWith(message);
		});
		// Structured-cloned, as it would be between two realms.
		expect(heard.mock.calls[0][0]).not.toBe(message);
	});

	it("hands every receiver the message though one of them throws", async () => {
		const logged = vi
			.spyOn(lankaLogger, "printScenarioLog")
			.mockImplementation(() => undefined);
		const sender = createLankaRelayBroadcastChannelTransport();
		const receiver = createLankaRelayBroadcastChannelTransport();
		const second = vi.fn();
		listen(receiver, () => {
			throw new Error("a receiver failed");
		});
		listen(receiver, second);
		listen(sender, () => undefined);

		sender.post("hello");

		await vi.waitFor(() => {
			expect(second).toHaveBeenCalledWith("hello");
		});
		expect(logged).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
	});

	it("closes its medium when the last subscriber leaves, and opens a new one for the next", () => {
		const closed = vi.spyOn(BroadcastChannel.prototype, "close");
		const transport = createLankaRelayBroadcastChannelTransport();

		const first = transport.subscribe(() => undefined);
		const second = transport.subscribe(() => undefined);
		first();
		expect(closed).not.toHaveBeenCalled();
		second();
		expect(closed).toHaveBeenCalledOnce();
		second();
		expect(closed).toHaveBeenCalledOnce();

		listen(transport, () => undefined);
		expect(closed).toHaveBeenCalledOnce();
	});

	it("refuses to be created where there is no BroadcastChannel, rather than deliver nothing", () => {
		// React Native, Safari before 15.4. The application asked for other realms;
		// a transport that stays silent there looks exactly like realms with nothing
		// to say.
		vi.stubGlobal("BroadcastChannel", undefined);

		expect(() => createLankaRelayBroadcastChannelTransport()).toThrowError(
			/needs BroadcastChannel/,
		);
	});
});
