import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaWebSocket, type ILankaWebSocketConfig } from "../../src/index";
import { PlaygroundRoomBridge } from "../playground-room-bridge/PlaygroundRoomBridge";
import { PlaygroundRoomGateway } from "../playground-room-gateway/PlaygroundRoomGateway";
import { PlaygroundWebSocket } from "../playground-web-socket/PlaygroundWebSocket";
import type { IPlaygroundRoom } from "../_interfaces/IPlaygroundRoom";

/** Starts a chat room over a socket, the way an application would. */
export const startPlaygroundRoom = (config: ILankaWebSocketConfig = {}): IPlaygroundRoom => {
	PlaygroundWebSocket.instances = [];
	(globalThis as { WebSocket?: unknown }).WebSocket = PlaygroundWebSocket;

	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	let isActive: () => boolean = () => false;

	const room = lankaWebSocket({
		path: "/room",
		...config,
		bridges: ({ socket, trigger }) => {
			isActive = trigger.isActive;
			return [new PlaygroundRoomBridge(socket, trigger)];
		},
	});

	lanka.use(room);

	// The outbound half, given the channel through its constructor — which is how
	// an application keeps sending out of its bridges and out of its screens.
	const gateway = new PlaygroundRoomGateway(room.socket);

	return {
		lanka,
		gateway,
		signIn: () => room.socket.connect(),
		isConnected: () => PlaygroundWebSocket.instances.length > 0,
		connection() {
			const socket = PlaygroundWebSocket.instances.at(-1);
			if (!socket) throw new Error("the plugin opened no connection");
			return socket;
		},
		// The one thing a server-sent stream cannot do, and it goes through the
		// gateway rather than through a bridge: a bridge is inbound only.
		say: (text) => gateway.say(text),
		moveCursor: (at) => gateway.moveCursor(at),
		isFromOutside: () => isActive(),
	};
};
