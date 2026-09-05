import type { ILankaPlugin } from "lanka";
import {
	lankaStream,
	type ALankaStreamBridge,
	type ILankaServerEventTransport,
	type ILankaStreamTriggerContext,
} from "lanka/stream";
import { LankaSseTransport, type ILankaSseConfig } from "../lanka-sse-transport/LankaSseTransport";

export interface ILankaSsePluginConfig extends ILankaSseConfig {
	/**
	 * The application's bridges, created by it — the package knows no event type.
	 *
	 * A factory rather than ready objects: a bridge needs the transport and the
	 * "from outside" marker, and both belong to THIS plugin installation.
	 */
	bridges?: (context: {
		sse: ILankaServerEventTransport;
		trigger: ILankaStreamTriggerContext;
	}) => readonly ALankaStreamBridge[];
	/**
	 * A connection this application supplies instead of the default one.
	 *
	 * The reason the port exists: an engine or a proxy that cannot carry
	 * `text/event-stream` leaves a WebSocket and nothing else, and everything
	 * above this line — bridges, the trigger marker, the plugin itself — cannot
	 * tell which one answered. `@lankajs/plugin-websocket` ships one that fits
	 * here unchanged.
	 */
	transport?: ILankaServerEventTransport;
	/**
	 * Connect as soon as the plugin is registered. Off by default.
	 *
	 * Deliberately off: the stream is opened for an AUTHENTICATED user, and when
	 * that happens is the application's knowledge. A plugin that connects by
	 * itself would open a connection on the sign-in screen.
	 */
	connectOnInstall?: boolean;
}

export interface ILankaSsePlugin extends ILankaPlugin {
	/** The event stream: subscribe, connect, disconnect. */
	readonly sse: ILankaServerEventTransport;
	/** The "this change came from the server" marker. */
	readonly trigger: ILankaStreamTriggerContext;
}

/**
 * The realtime plugin: one SSE transport, the application's bridges attached to
 * it, and a trigger context carrying the "from outside" marker.
 *
 * Assembly, installation order and teardown belong to `lankaStream`; this
 * package contributes the connection and the word `sse` in the names an
 * application already wrote. Naming the context field `sse` rather than
 * `stream` is the whole difference between the two, and it is kept because the
 * alternative is a rename across every consumer's bridge file for nothing.
 */
export const lankaSse = (config: ILankaSsePluginConfig = {}): ILankaSsePlugin => {
	// The default the plugin picks, and the seam for the one it did not: a proxy
	// that strips `text/event-stream` leaves an application with a WebSocket, and
	// nothing above this line can tell the difference.
	const sse = config.transport ?? new LankaSseTransport(config);

	const stream = lankaStream({
		name: "@lankajs/plugin-sse",
		transport: sse,
		connectOnInstall: config.connectOnInstall,
		bridges: ({ stream: transport, trigger }) =>
			config.bridges?.({ sse: transport, trigger }) ?? [],
	});

	return {
		name: stream.name,
		sse,
		trigger: stream.trigger,
		install: stream.install,
	};
};
