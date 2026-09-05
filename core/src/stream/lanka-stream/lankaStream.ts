import type { ILankaPlugin } from "../../bootstrap/ILankaPlugin";
import type { ILankaServerEventTransport } from "../_interfaces/ILankaServerEventTransport";
import type { ALankaStreamBridge } from "../_abstractions/lanka-stream-bridge/ALankaStreamBridge";
import {
	createLankaStreamTriggerContext,
	type ILankaStreamTriggerContext,
} from "../_factories/create-lanka-stream-trigger-context/createLankaStreamTriggerContext";

/** What the bridges factory is handed: the connection, and the marker. */
export interface ILankaStreamPluginContext {
	stream: ILankaServerEventTransport;
	trigger: ILankaStreamTriggerContext;
}

export interface ILankaStreamPluginConfig {
	/** The connection this plugin owns for its lifetime. */
	transport: ILankaServerEventTransport;
	/**
	 * The application's bridges, created by it — the framework knows no event type.
	 *
	 * A factory rather than ready objects: a bridge needs the transport and the
	 * "from outside" marker, and both belong to THIS plugin installation. The same
	 * bridge declaration can therefore be handed to two instances in one process.
	 */
	bridges?: (context: ILankaStreamPluginContext) => readonly ALankaStreamBridge[];
	/**
	 * Connect as soon as the plugin is registered. Off by default.
	 *
	 * Deliberately off: the stream is opened for an AUTHENTICATED user, and when
	 * that happens is the application's knowledge. A plugin that connected by
	 * itself would open a connection on the sign-in screen.
	 */
	connectOnInstall?: boolean;
	/**
	 * The name the plugin is registered under. Defaults to `lanka/stream`.
	 *
	 * A protocol package passes its own npm name, so a duplicate registration
	 * names the package a reader can go and look at. Registering twice is refused
	 * by the registry, and two copies of one connection is exactly the mistake
	 * worth refusing.
	 */
	name?: string;
}

export interface ILankaStreamPlugin extends ILankaPlugin {
	/** The connection: subscribe, connect, disconnect. */
	readonly stream: ILankaServerEventTransport;
	/** The "this change came from the server" marker. */
	readonly trigger: ILankaStreamTriggerContext;
}

/**
 * A pushing connection wired into the framework's lifetime.
 *
 * Usable directly — hand it any `ILankaServerEventTransport` and your bridges —
 * and it is also what every protocol plugin in this repository is built on, so
 * the four of them cannot disagree about installation order.
 *
 * ## The order in teardown is the whole point
 *
 * Bridges are detached BEFORE the connection is closed. The other order leaves
 * them a window in which a dying connection delivers one last event into
 * scenarios belonging to an instance that is being disposed.
 */
export const lankaStream = (config: ILankaStreamPluginConfig): ILankaStreamPlugin => {
	const stream = config.transport;
	const trigger = createLankaStreamTriggerContext();

	return {
		name: config.name ?? "lanka/stream",
		stream,
		trigger,
		install() {
			const bridges = config.bridges?.({ stream, trigger }) ?? [];
			for (const bridge of bridges) bridge.register();

			if (config.connectOnInstall) stream.connect();

			return () => {
				for (const bridge of bridges) bridge.dispose();
				stream.disconnect();
			};
		},
	};
};
