import type { ILankaPlugin } from "lanka";
import {
	lankaStream,
	type ALankaStreamBridge,
	type ILankaServerEventTransport,
	type ILankaStreamTriggerContext,
} from "lanka/stream";

export interface ILankaGrpcPluginConfig {
	/**
	 * The stream this plugin owns for its lifetime.
	 *
	 * REQUIRED, unlike the other transports in this repository, and the reason is
	 * the codec: a stream cannot be built without knowing how its messages are
	 * encoded, and this package must not guess. `createLankaGrpcStreamTransport`
	 * is what builds one.
	 */
	transport: ILankaServerEventTransport;
	/**
	 * The application's bridges, created by it — the package knows no event type.
	 *
	 * A factory rather than ready objects: a bridge needs the connection and the
	 * "from outside" marker, and both belong to THIS plugin installation.
	 */
	bridges?: (context: {
		stream: ILankaServerEventTransport;
		trigger: ILankaStreamTriggerContext;
	}) => readonly ALankaStreamBridge[];
	/**
	 * Connect as soon as the plugin is registered. Off by default.
	 *
	 * Deliberately off: the stream is opened for an AUTHENTICATED user, and when
	 * that happens is the application's knowledge. A plugin that connected by
	 * itself would open a call on the sign-in screen and present no credentials.
	 */
	connectOnInstall?: boolean;
}

export interface ILankaGrpcPlugin extends ILankaPlugin {
	/** The server stream: subscribe, connect, disconnect. */
	readonly stream: ILankaServerEventTransport;
	/** The "this change came from the server" marker. */
	readonly trigger: ILankaStreamTriggerContext;
}

/**
 * A gRPC server stream wired into the framework's lifetime.
 *
 * ## Only streams
 *
 * Unary calls need no plugin and no `use()`: they are ordinary requests, and
 * `ALankaGrpcGateway` or `createLankaGrpcRequest` is the whole of it. A plugin
 * exists here because a STREAM is a connection, and a connection needs a
 * lifetime to belong to — opened when a session exists, closed when the instance
 * is disposed, with the bridges detached first.
 *
 * An application making only unary calls never installs this and loses nothing.
 */
export const lankaGrpc = (config: ILankaGrpcPluginConfig): ILankaGrpcPlugin => {
	const stream = lankaStream({
		name: "@lankajs/plugin-grpc",
		transport: config.transport,
		connectOnInstall: config.connectOnInstall,
		bridges: ({ trigger }) => config.bridges?.({ stream: config.transport, trigger }) ?? [],
	});

	return {
		name: stream.name,
		stream: config.transport,
		trigger: stream.trigger,
		install: stream.install,
	};
};
