import { describe, expect, it, vi } from "vitest";
import { AtlasBoardChannel } from "./AtlasBoardChannel";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

const fakeChannel = (sent = true) => {
	const calls: { type: string; payload: Record<string, unknown> }[] = [];

	return {
		calls,
		channel: {
			send: vi.fn((type: string, payload: Record<string, unknown>) => {
				calls.push({ type, payload });

				return sent;
			}),
		} as unknown as ILankaWebSocketChannel,
	};
};

describe("AtlasBoardChannel", () => {
	it("sends what somebody said, under the type the server reads", () => {
		const wire = fakeChannel();

		new AtlasBoardChannel(wire.channel).say("north ridge clear");

		expect(wire.calls).toEqual([{ type: "board.say", payload: { text: "north ridge clear" } }]);
	});

	it("sends a completion over the socket, which is a different wire for one intent", () => {
		const wire = fakeChannel();

		new AtlasBoardChannel(wire.channel).complete("m-2");

		expect(wire.calls[0].type).toBe("mission.complete");
	});

	it("reports that a message was HELD rather than pretending it went", () => {
		// Both answers are ordinary: `false` means the link was down and the
		// message is waiting for the next connection. A caller whose message
		// expires branches on it.
		const wire = fakeChannel(false);

		expect(new AtlasBoardChannel(wire.channel).say("cursor moved")).toBe(false);
	});

	it("opens no socket of its own, which is what makes it testable at all", () => {
		// The channel arrives in the constructor. A gateway that opened its own
		// connection could only be tested by opening one.
		const wire = fakeChannel();
		const channel = new AtlasBoardChannel(wire.channel);

		channel.say("hello");

		expect(vi.mocked(wire.channel.send)).toHaveBeenCalledTimes(1);
	});
});
