import type { ILankaPlugin } from "lanka";
import { LankaSseTransport, type ILankaSseConfig } from "../lanka-sse-transport/LankaSseTransport";
import type { ILankaServerEventTransport } from "../_interfaces/ILankaServerEventTransport";
import {
	createLankaSseTriggerContext,
	type ILankaSseTriggerContext,
} from "../_factories/create-lanka-sse-trigger-context/createLankaSseTriggerContext";
import type { ALankaSseBridge } from "../_abstractions/lanka-sse-bridge/ALankaSseBridge";

export interface ILankaSsePluginConfig extends ILankaSseConfig {
	/**
	 * The application's bridges, created by it — the package knows no event type.
	 *
	 * A factory rather than ready objects: a bridge needs the transport and the
	 * "from outside" marker, and both belong to THIS plugin installation.
	 */
	bridges?: (context: {
		sse: ILankaServerEventTransport;
		trigger: ILankaSseTriggerContext;
	}) => readonly ALankaSseBridge[];
	/**
	 * A connection this application supplies instead of the default one.
	 *
	 * The reason the port exists: an engine or a proxy that cannot carry
	 * `text/event-stream` leaves a WebSocket and nothing else, and everything
	 * above this line — bridges, the trigger marker, the plugin itself — cannot
	 * tell which one answered.
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
	readonly trigger: ILankaSseTriggerContext;
}

/**
 * The realtime plugin: one SSE transport, the application's bridges attached to
 * it, and a trigger context carrying the "from outside" marker.
 */
export const lankaSse = (config: ILankaSsePluginConfig = {}): ILankaSsePlugin => {
	// The default the plugin picks, and the seam for the one it did not: a proxy
	// that strips `text/event-stream` leaves an application with a WebSocket, and
	// nothing above this line can tell the difference.
	const sse = config.transport ?? new LankaSseTransport(config);
	const trigger = createLankaSseTriggerContext();

	return {
		name: "@lankajs/plugin-sse",
		sse,
		trigger,
		install() {
			const bridges = config.bridges?.({ sse, trigger }) ?? [];
			for (const bridge of bridges) bridge.register();

			if (config.connectOnInstall) sse.connect();

			return () => {
				// Bridges are detached BEFORE the stream is closed: doing it after would
				// leave them a chance to receive one last event from a dead connection.
				for (const bridge of bridges) bridge.dispose();
				sse.disconnect();
			};
		},
	};
};
