import type { ILankaPlugin } from "lanka";
import {
	lankaStream,
	type ALankaStreamBridge,
	type ILankaStreamTriggerContext,
} from "lanka/stream";
import {
	LankaWebSocketTransport,
	type ILankaWebSocketConfig,
} from "../lanka-web-socket-transport/LankaWebSocketTransport";
import type { ILankaWebSocketChannel } from "../_interfaces/ILankaWebSocketChannel";

export interface ILankaWebSocketPluginConfig extends ILankaWebSocketConfig {
	/**
	 * The application's bridges, created by it — the package knows no event type.
	 *
	 * A factory rather than ready objects: a bridge needs the channel and the
	 * "from outside" marker, and both belong to THIS plugin installation.
	 */
	bridges?: (context: {
		socket: ILankaWebSocketChannel;
		trigger: ILankaStreamTriggerContext;
	}) => readonly ALankaStreamBridge[];
	/**
	 * A channel this application supplies instead of the default one.
	 *
	 * What it is for: a socket the application already opened for something else,
	 * a native bridge that is not a `WebSocket` at all, or a double in a test.
	 */
	transport?: ILankaWebSocketChannel;
	/**
	 * Connect as soon as the plugin is registered. Off by default.
	 *
	 * Deliberately off: the socket is opened for an AUTHENTICATED user, and when
	 * that happens is the application's knowledge. A plugin that connects by
	 * itself would open a connection on the sign-in screen.
	 */
	connectOnInstall?: boolean;
}

export interface ILankaWebSocketPlugin extends ILankaPlugin {
	/** The channel: subscribe, send, connect, disconnect. */
	readonly socket: ILankaWebSocketChannel;
	/** The "this change came from the server" marker. */
	readonly trigger: ILankaStreamTriggerContext;
}

/**
 * A WebSocket wired into the framework's lifetime.
 *
 * Installation, teardown order and the marker are `lankaStream`'s, so this
 * plugin and `@lankajs/plugin-sse` cannot disagree about them. What this package
 * contributes is the connection — and `socket` rather than `sse` in the bridges
 * context, because on this wire the object can also answer.
 *
 * The channel is exposed on the plugin rather than handed to bridges alone: a
 * bridge is inbound only, and whatever sends — a gateway, a ViewModel — takes
 * `plugin.socket` in its constructor and is testable without a socket.
 */
export const lankaWebSocket = (config: ILankaWebSocketPluginConfig = {}): ILankaWebSocketPlugin => {
	const socket = config.transport ?? new LankaWebSocketTransport(config);

	const stream = lankaStream({
		name: "@lankajs/plugin-websocket",
		transport: socket,
		connectOnInstall: config.connectOnInstall,
		bridges: ({ trigger }) => config.bridges?.({ socket, trigger }) ?? [],
	});

	return {
		name: stream.name,
		socket,
		trigger: stream.trigger,
		install: stream.install,
	};
};
